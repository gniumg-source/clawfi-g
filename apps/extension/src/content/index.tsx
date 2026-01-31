/**
 * ClawFi Extension - Content Script
 * 
 * Detects token addresses on supported pages and shows overlay with signals
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Ethereum address regex
const ETH_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

// Chain detection from URL
function detectChain(url: string): string | undefined {
  if (url.includes('etherscan.io')) return 'ethereum';
  if (url.includes('arbiscan.io')) return 'arbitrum';
  if (url.includes('basescan.org')) return 'base';
  if (url.includes('dexscreener.com')) {
    if (url.includes('/ethereum/')) return 'ethereum';
    if (url.includes('/arbitrum/')) return 'arbitrum';
    if (url.includes('/base/')) return 'base';
  }
  return undefined;
}

// Detect token address from page
function detectTokenAddress(): string | null {
  const url = window.location.href;
  
  // Try URL first
  const urlMatch = url.match(ETH_ADDRESS_REGEX);
  if (urlMatch) {
    return urlMatch[0]!;
  }
  
  // Try page content
  const pageText = document.body.innerText;
  const pageMatches = pageText.match(ETH_ADDRESS_REGEX);
  if (pageMatches && pageMatches.length > 0) {
    // Return first unique address that looks like a token (not common addresses)
    const commonAddresses = new Set([
      '0x0000000000000000000000000000000000000000',
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    ]);
    for (const addr of pageMatches) {
      if (!commonAddresses.has(addr.toLowerCase())) {
        return addr;
      }
    }
  }
  
  return null;
}

// Detect wallet providers
function detectWalletPresence(): { ethereum: boolean; solana: boolean } {
  return {
    ethereum: typeof (window as unknown as { ethereum?: unknown }).ethereum !== 'undefined',
    solana: typeof (window as unknown as { solana?: unknown }).solana !== 'undefined',
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
function ClawFiOverlay() {
  const [token, setToken] = useState<string | null>(null);
  const [chain, setChain] = useState<string | undefined>();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [wallets, setWallets] = useState({ ethereum: false, solana: false });

  useEffect(() => {
    // Check settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings: Settings) => {
      setEnabled(settings.overlayEnabled);
    });

    // Detect wallets
    setWallets(detectWalletPresence());

    // Detect token
    const detectedToken = detectTokenAddress();
    const detectedChain = detectChain(window.location.href);
    
    if (detectedToken) {
      setToken(detectedToken);
      setChain(detectedChain);
      
      // Notify background
      chrome.runtime.sendMessage({
        type: 'DETECTED_TOKEN',
        token: detectedToken,
        chain: detectedChain,
      });
      
      // Fetch signals
      setLoading(true);
      chrome.runtime.sendMessage(
        { type: 'GET_SIGNALS', token: detectedToken, chain: detectedChain },
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
            background: 'linear-gradient(135deg, #14b899 0%, #0d957d 100%)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(20, 184, 153, 0.4)',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>C</span>
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
            border: '1px solid #1a2530',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #14b899 0%, #0d957d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 'bold', color: 'white', fontSize: '14px' }}>
              ClawFi
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
              {chain && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#14b899',
                    textTransform: 'capitalize',
                  }}
                >
                  {chain}
                </span>
              )}
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
            <span style={{ color: wallets.ethereum ? '#14b899' : '#64748b' }}>
              {wallets.ethereum ? '✓' : '○'} MetaMask
            </span>
            <span style={{ color: wallets.solana ? '#14b899' : '#64748b' }}>
              {wallets.solana ? '✓' : '○'} Phantom
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
            ClawFi v0.1.0 • Configure in extension options
          </div>
        </div>
      )}
    </div>
  );
}

// Mount the overlay
function mountOverlay() {
  const container = document.createElement('div');
  container.id = 'clawfi-overlay-root';
  document.body.appendChild(container);
  
  const root = createRoot(container);
  root.render(<ClawFiOverlay />);
}

// Wait for page to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOverlay);
} else {
  mountOverlay();
}


