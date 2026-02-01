/**
 * ClawFi Options Page Script
 * Handles settings persistence with local storage priority
 */

var defaultSettings = {
  nodeUrl: 'https://api.clawfi.ai',
  authToken: '',
  overlayEnabled: true,
  clankerOverlayEnabled: true,
};

var form = document.getElementById('settings-form');
var nodeUrlInput = document.getElementById('nodeUrl');
var authTokenInput = document.getElementById('authToken');
var overlayEnabledInput = document.getElementById('overlayEnabled');
var clankerOverlayEnabledInput = document.getElementById('clankerOverlayEnabled');
var statusEl = document.getElementById('status');
var statusIconEl = document.getElementById('status-icon');
var statusTextEl = document.getElementById('status-text');

function showStatus(type, icon, text) {
  statusEl.className = 'status ' + type;
  statusIconEl.textContent = icon;
  statusTextEl.textContent = text;
  if (type === 'success') {
    setTimeout(function() { statusEl.className = 'status'; }, 3000);
  }
}

function applySettings(settings) {
  console.log('[ClawFi Options] Applying settings:', { ...settings, authToken: settings.authToken ? '***' : '' });
  nodeUrlInput.value = settings.nodeUrl || defaultSettings.nodeUrl;
  authTokenInput.value = settings.authToken || '';
  overlayEnabledInput.checked = settings.overlayEnabled !== false;
  clankerOverlayEnabledInput.checked = settings.clankerOverlayEnabled !== false;
}

function loadSettings() {
  console.log('[ClawFi Options] Loading settings...');
  // Try local storage first (more reliable for large tokens)
  chrome.storage.local.get('settings', function(localResult) {
    var error = chrome.runtime.lastError;
    if (error) {
      console.error('[ClawFi Options] Local storage error:', error);
    }
    
    if (localResult && localResult.settings && localResult.settings.authToken) {
      console.log('[ClawFi Options] Loaded from local storage');
      applySettings(localResult.settings);
    } else {
      // Fall back to sync storage
      chrome.storage.sync.get('settings', function(syncResult) {
        var syncError = chrome.runtime.lastError;
        if (syncError) {
          console.error('[ClawFi Options] Sync storage error:', syncError);
        }
        
        if (syncResult && syncResult.settings) {
          console.log('[ClawFi Options] Loaded from sync storage');
          applySettings(syncResult.settings);
        } else {
          console.log('[ClawFi Options] Using defaults');
          applySettings(defaultSettings);
        }
      });
    }
  });
}

function saveSettings(e) {
  e.preventDefault();
  
  var settings = {
    nodeUrl: nodeUrlInput.value.trim() || defaultSettings.nodeUrl,
    authToken: authTokenInput.value.trim(),
    overlayEnabled: overlayEnabledInput.checked,
    clankerOverlayEnabled: clankerOverlayEnabledInput.checked,
  };
  
  console.log('[ClawFi Options] Saving settings...', { ...settings, authToken: settings.authToken ? '***' : '' });
  
  // Save to local storage first (more reliable, no size limits for tokens)
  chrome.storage.local.set({ settings: settings }, function() {
    var localError = chrome.runtime.lastError;
    if (localError) {
      console.error('[ClawFi Options] Local save error:', localError);
      showStatus('error', '✗', 'Error saving: ' + localError.message);
      return;
    }
    
    console.log('[ClawFi Options] Saved to local storage');
    
    // Also save to sync (but don't fail if it errors due to size)
    chrome.storage.sync.set({ settings: settings }, function() {
      var syncError = chrome.runtime.lastError;
      if (syncError) {
        console.warn('[ClawFi Options] Sync save warning:', syncError);
        // Still show success since local save worked
      } else {
        console.log('[ClawFi Options] Saved to sync storage');
      }
      
      showStatus('success', '✓', 'Settings saved!');
      
      // Notify background script
      try {
        chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: settings }, function(response) {
          var msgError = chrome.runtime.lastError;
          if (msgError) {
            console.warn('[ClawFi Options] Background message error:', msgError);
          } else {
            console.log('[ClawFi Options] Background notified');
          }
        });
      } catch (err) {
        console.warn('[ClawFi Options] Message send error:', err);
      }
    });
  });
  
  return false;
}

// Also save when input loses focus (in case form isn't submitted)
function saveOnBlur() {
  var currentToken = authTokenInput.value.trim();
  if (currentToken) {
    console.log('[ClawFi Options] Auto-saving on blur...');
    var settings = {
      nodeUrl: nodeUrlInput.value.trim() || defaultSettings.nodeUrl,
      authToken: currentToken,
      overlayEnabled: overlayEnabledInput.checked,
      clankerOverlayEnabled: clankerOverlayEnabledInput.checked,
    };
    chrome.storage.local.set({ settings: settings });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  form.addEventListener('submit', saveSettings);
  authTokenInput.addEventListener('blur', saveOnBlur);
  nodeUrlInput.addEventListener('blur', saveOnBlur);
});
