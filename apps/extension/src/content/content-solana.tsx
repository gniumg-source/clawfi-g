/**
 * ClawFi Extension - Solana Content Script
 * 
 * Detects Solana token addresses on supported pages and shows overlay with signals
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Solana address regex (base58 encoded, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// Common Solana addresses to ignore
const IGNORED_ADDRESSES = new Set([
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
]);

// Detect Solana address from page
function detectSolanaAddress(): string | null {
  const url = window.location.href;
  
  // Try URL first for specific patterns
  if (url.includes('solscan.io/token/') || url.includes('solscan.io/account/')) {
    const match = url.match(/(?:token|account)\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (match) return match[1];
  }
  
  if (url.includes('pump.fun/')) {
    const match = url.match(/pump\.fun\/(?:coin|profile)\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (match) return match[1];
  }
  
  // Try URL match
  const urlMatches = url.match(SOLANA_ADDRESS_REGEX);
  if (urlMatches) {
    for (const addr of urlMatches) {
      if (!IGNORED_ADDRESSES.has(addr) && addr.length >= 32) {
        return addr;
      }
    }
  }
  
  // Try page content
  const pageText = document.body.innerText;
  const pageMatches = pageText.match(SOLANA_ADDRESS_REGEX);
  if (pageMatches) {
    for (const addr of pageMatches) {
      if (!IGNORED_ADDRESSES.has(addr) && addr.length >= 32) {
        return addr;
      }
    }
  }
  
  return null;
}

// Detect wallet presence
function detectWalletPresence(): { phantom: boolean; solflare: boolean } {
  const win = window as unknown as { 
    solana?: { isPhantom?: boolean }; 
    solflare?: unknown;
  };
  return {
    phantom: typeof win.solana !== 'undefined' && win.solana.isPhantom === true,
    solflare: typeof win.solflare !== 'undefined',
  };
}

interface Signal {
  id: string;
  ts: number;
  severity: string;
  title: string;
  summary: string;
  recommendedAction: string;
}

interface Settings {
  nodeUrl: string;
  authToken: string;
  overlayEnabled: boolean;
}

// Overlay component
function ClawFiSolanaOverlay() {
  const [token, setToken] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [wallets, setWallets] = useState({ phantom: false, solflare: false });

  useEffect(() => {
    // Check settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings: Settings) => {
      setEnabled(settings.overlayEnabled);
    });

    // Detect wallets
    setWallets(detectWalletPresence());

    // Detect token
    const detectedToken = detectSolanaAddress();
    
    if (detectedToken) {
      setToken(detectedToken);
      
      // Notify background
      chrome.runtime.sendMessage({
        type: 'DETECTED_TOKEN',
        token: detectedToken,
        chain: 'solana',
        source: window.location.host.includes('pump.fun') ? 'pumpfun' : 'solscan',
      });
      
      // Fetch signals
      setLoading(true);
      chrome.runtime.sendMessage(
        { type: 'GET_SIGNALS', token: detectedToken, chain: 'solana' },
        (data: Signal[]) => {
          setSignals(data || []);
          setLoading(false);
        }
      );
    }
  }, []);

  if (!enabled || !token) {
    return null;
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const severityColor: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
    info: '#64748b',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 999999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Collapsed button */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(153, 69, 255, 0.4)',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>S</span>
          {signals.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '20px',
                height: '20px',
                borderRadius: '10px',
                background: '#ef4444',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {signals.length}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            width: '320px',
            background: '#0a0f14',
            borderRadius: '12px',
            border: '1px solid #9945FF33',
            boxShadow: '0 8px 32px rgba(153, 69, 255, 0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 'bold', color: 'white', fontSize: '14px' }}>
              ClawFi • Solana
            </span>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ×
            </button>
          </div>

          {/* Token info */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a2530' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
              Detected Token
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code
                style={{
                  fontSize: '13px',
                  color: '#f1f5f9',
                  background: '#1a2530',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
              >
                {formatAddress(token)}
              </code>
              <span
                style={{
                  fontSize: '11px',
                  color: '#14F195',
                }}
              >
                Solana
              </span>
            </div>
          </div>

          {/* Wallet status */}
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid #1a2530',
              display: 'flex',
              gap: '12px',
              fontSize: '11px',
            }}
          >
            <span style={{ color: wallets.phantom ? '#9945FF' : '#64748b' }}>
              {wallets.phantom ? '✓' : '○'} Phantom
            </span>
            <span style={{ color: wallets.solflare ? '#14F195' : '#64748b' }}>
              {wallets.solflare ? '✓' : '○'} Solflare
            </span>
          </div>

          {/* Signals */}
          <div style={{ maxHeight: '240px', overflow: 'auto' }}>
            {loading ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Loading signals...
              </div>
            ) : signals.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                No signals for this token
              </div>
            ) : (
              signals.map((signal) => (
                <div
                  key={signal.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #1a2530',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '4px',
                        background: severityColor[signal.severity] || '#3b82f6',
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#f1f5f9' }}>
                      {signal.title}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      margin: '0 0 4px 16px',
                      lineHeight: '1.4',
                    }}
                  >
                    {signal.summary.slice(0, 100)}
                    {signal.summary.length > 100 ? '...' : ''}
                  </p>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      marginLeft: '16px',
                    }}
                  >
                    {formatTime(signal.ts)} • {signal.recommendedAction.replace('_', ' ')}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '8px 16px',
              background: '#0d1117',
              fontSize: '11px',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            ClawFi v0.2.1 • Solana Support
          </div>
        </div>
      )}
    </div>
  );
}

// Mount the overlay
function mountOverlay() {
  const container = document.createElement('div');
  container.id = 'clawfi-solana-overlay-root';
  document.body.appendChild(container);
  
  const root = createRoot(container);
  root.render(<ClawFiSolanaOverlay />);
}

// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOverlay);
} else {
  mountOverlay();
}
