/**
 * ClawFi Extension - Solana Content Script
 * 
 * Detects Solana token addresses on supported pages and shows overlay with signals.
 * Design: Apple Liquid Glass (iOS 26)
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const VERSION = '0.3.1';

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

interface MarketData {
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  dexscreenerUrl: string;
}

interface Settings {
  nodeUrl: string;
  authToken: string;
  overlayEnabled: boolean;
}

// Format number for display
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

// Liquid Glass styles
const glassStyles = {
  overlay: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    zIndex: 2147483647,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    WebkitFontSmoothing: 'antialiased' as const,
  },
  fab: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'linear-gradient(180deg, rgba(153, 69, 255, 0.9) 0%, rgba(20, 241, 149, 0.9) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 40px rgba(153, 69, 255, 0.4), 0 2px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  fabIcon: {
    fontSize: '28px',
    position: 'relative' as const,
    zIndex: 1,
  },
  badge: {
    position: 'absolute' as const,
    top: '-5px',
    right: '-5px',
    minWidth: '22px',
    height: '22px',
    borderRadius: '11px',
    background: '#FF453A',
    color: 'white',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    boxShadow: '0 2px 8px rgba(255, 69, 58, 0.5)',
    zIndex: 2,
  },
  panel: {
    width: '380px',
    background: 'rgba(30, 30, 40, 0.75)',
    backdropFilter: 'blur(60px) saturate(200%)',
    WebkitBackdropFilter: 'blur(60px) saturate(200%)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    overflow: 'hidden' as const,
    animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  header: {
    padding: '18px 20px',
    background: 'linear-gradient(180deg, rgba(153, 69, 255, 0.85) 0%, rgba(20, 241, 149, 0.85) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative' as const,
    borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
  },
  headerTitle: {
    fontWeight: 600,
    color: 'white',
    fontSize: '17px',
    letterSpacing: '-0.3px',
    position: 'relative' as const,
    zIndex: 1,
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    color: 'white',
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    transition: 'all 0.2s ease',
  },
  section: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sectionTitle: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '12px',
    fontWeight: 600,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
  },
  value: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  address: {
    fontFamily: '"SF Mono", Menlo, Monaco, monospace',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: '6px 12px',
    borderRadius: '10px',
    fontSize: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  chainBadge: {
    background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.3) 0%, rgba(20, 241, 149, 0.3) 100%)',
    color: '#14F195',
    padding: '5px 12px',
    borderRadius: '100px',
    fontSize: '12px',
    fontWeight: 500,
    border: '1px solid rgba(20, 241, 149, 0.35)',
  },
  walletBadge: (connected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: 500,
    background: connected ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 255, 255, 0.05)',
    color: connected ? '#30D158' : 'rgba(255, 255, 255, 0.4)',
    border: `1px solid ${connected ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
  }),
  marketGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginTop: '12px',
  },
  marketCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '14px',
    padding: '12px 14px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  marketLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: '4px',
  },
  marketValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  signalsContainer: {
    maxHeight: '200px',
    overflowY: 'auto' as const,
  },
  signal: {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'background 0.2s ease',
  },
  signalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  signalDot: (severity: string) => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
    background: severity === 'critical' ? '#FF453A' : 
                severity === 'high' ? '#FF9F0A' : 
                severity === 'medium' ? '#FFD60A' : '#0A84FF',
    boxShadow: `0 0 8px ${severity === 'critical' ? '#FF453A' : 
                         severity === 'high' ? '#FF9F0A' : 
                         severity === 'medium' ? '#FFD60A' : '#0A84FF'}`,
  }),
  signalTitle: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: 500,
    fontSize: '14px',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  signalSummary: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px',
    marginLeft: '20px',
    marginBottom: '4px',
    lineHeight: 1.5,
  },
  signalMeta: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '12px',
    marginLeft: '20px',
  },
  empty: {
    padding: '32px',
    textAlign: 'center' as const,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '14px',
  },
  footer: {
    padding: '14px 20px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '11px',
  },
  dashboardBtn: {
    background: 'rgba(153, 69, 255, 0.5)',
    color: 'white',
    border: '1px solid rgba(153, 69, 255, 0.6)',
    padding: '10px 18px',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
  },
};

// Overlay component
function ClawFiSolanaOverlay() {
  const [token, setToken] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [wallets, setWallets] = useState({ phantom: false, solflare: false });
  const [activeTab, setActiveTab] = useState<'signals' | 'market'>('signals');

  useEffect(() => {
    // Check settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings: Settings) => {
      setEnabled(settings?.overlayEnabled !== false);
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
      
      // Fetch market data
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (settings: Settings) => {
        if (!settings) return;
        try {
          const nodeUrl = settings.nodeUrl || 'https://api.clawfi.ai';
          const response = await fetch(`${nodeUrl}/dexscreener/token/${detectedToken}?chain=solana`, {
            headers: settings.authToken ? { 'Authorization': `Bearer ${settings.authToken}` } : {},
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setMarketData({
                priceUsd: data.data.priceUsd || 0,
                priceChange24h: data.data.priceChange24h || 0,
                volume24h: data.data.volume24h || 0,
                liquidity: data.data.liquidity || 0,
                marketCap: data.data.marketCap,
                dexscreenerUrl: data.data.dexscreenerUrl || '',
              });
            }
          }
        } catch (err) {
          console.warn('[ClawFi] Market data error:', err);
        }
      });
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

  return (
    <div style={glassStyles.overlay}>
      {/* Inject keyframes */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      
      {/* Collapsed FAB */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={glassStyles.fab}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08) translateY(-3px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={glassStyles.fabIcon}>🦀</span>
          {signals.length > 0 && (
            <span style={glassStyles.badge}>{signals.length}</span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div style={glassStyles.panel}>
          {/* Header */}
          <div style={glassStyles.header}>
            <span style={glassStyles.headerTitle}>🦀 ClawFi • Solana</span>
            <button
              onClick={() => setExpanded(false)}
              style={glassStyles.closeBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ×
            </button>
          </div>

          {/* Token info */}
          <div style={glassStyles.section}>
            <div style={glassStyles.sectionTitle}>Detected Token</div>
            <div style={glassStyles.row}>
              <span style={glassStyles.label}>Address</span>
              <span style={glassStyles.value}>
                <code style={glassStyles.address}>{formatAddress(token)}</code>
                <span style={glassStyles.chainBadge}>◎ Solana</span>
              </span>
            </div>
          </div>

          {/* Wallet status */}
          <div style={{ ...glassStyles.section, display: 'flex', gap: '10px', padding: '12px 20px' }}>
            <span style={glassStyles.walletBadge(wallets.phantom)}>
              {wallets.phantom ? '✓' : '○'} Phantom
            </span>
            <span style={glassStyles.walletBadge(wallets.solflare)}>
              {wallets.solflare ? '✓' : '○'} Solflare
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', padding: '12px 16px', gap: '8px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setActiveTab('signals')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: activeTab === 'signals' ? '1px solid rgba(153, 69, 255, 0.5)' : '1px solid transparent',
                background: activeTab === 'signals' ? 'rgba(153, 69, 255, 0.3)' : 'transparent',
                color: activeTab === 'signals' ? 'white' : 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              🚨 Signals {signals.length > 0 && `(${signals.length})`}
            </button>
            <button
              onClick={() => setActiveTab('market')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: activeTab === 'market' ? '1px solid rgba(20, 241, 149, 0.5)' : '1px solid transparent',
                background: activeTab === 'market' ? 'rgba(20, 241, 149, 0.3)' : 'transparent',
                color: activeTab === 'market' ? 'white' : 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              📊 Market
            </button>
          </div>

          {/* Content */}
          {activeTab === 'signals' ? (
            <div style={glassStyles.signalsContainer}>
              {loading ? (
                <div style={glassStyles.empty}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      border: '2.5px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#9945FF',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto',
                    }} />
                  </div>
                  Loading signals...
                </div>
              ) : signals.length === 0 ? (
                <div style={glassStyles.empty}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✨</div>
                  No signals detected
                  <div style={{ fontSize: '12px', marginTop: '4px', color: 'rgba(255,255,255,0.3)' }}>
                    This token appears clean
                  </div>
                </div>
              ) : (
                signals.map((signal) => (
                  <div key={signal.id} style={glassStyles.signal}>
                    <div style={glassStyles.signalHeader}>
                      <span style={glassStyles.signalDot(signal.severity)} />
                      <span style={glassStyles.signalTitle}>{signal.title}</span>
                    </div>
                    <p style={glassStyles.signalSummary}>
                      {signal.summary.slice(0, 100)}{signal.summary.length > 100 ? '...' : ''}
                    </p>
                    <div style={glassStyles.signalMeta}>
                      {formatTime(signal.ts)} • {signal.recommendedAction.replace('_', ' ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={glassStyles.section}>
              {marketData ? (
                <div style={glassStyles.marketGrid}>
                  <div style={glassStyles.marketCard}>
                    <div style={glassStyles.marketLabel}>Price</div>
                    <div style={glassStyles.marketValue}>
                      ${marketData.priceUsd < 0.01 ? marketData.priceUsd.toExponential(2) : marketData.priceUsd.toFixed(4)}
                    </div>
                    <div style={{ fontSize: '12px', color: marketData.priceChange24h >= 0 ? '#30D158' : '#FF453A' }}>
                      {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h.toFixed(2)}%
                    </div>
                  </div>
                  <div style={glassStyles.marketCard}>
                    <div style={glassStyles.marketLabel}>Volume 24h</div>
                    <div style={glassStyles.marketValue}>${formatNumber(marketData.volume24h)}</div>
                  </div>
                  <div style={glassStyles.marketCard}>
                    <div style={glassStyles.marketLabel}>Liquidity</div>
                    <div style={glassStyles.marketValue}>${formatNumber(marketData.liquidity)}</div>
                  </div>
                  <div style={glassStyles.marketCard}>
                    <div style={glassStyles.marketLabel}>Market Cap</div>
                    <div style={glassStyles.marketValue}>
                      {marketData.marketCap ? '$' + formatNumber(marketData.marketCap) : 'N/A'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={glassStyles.empty}>Loading market data...</div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={glassStyles.footer}>
            <span style={glassStyles.footerText}>ClawFi v{VERSION}</span>
            <a
              href={`https://dashboard.clawfi.ai/signals?token=${token}`}
              target="_blank"
              rel="noopener noreferrer"
              style={glassStyles.dashboardBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(153, 69, 255, 0.65)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(153, 69, 255, 0.5)';
              }}
            >
              Dashboard
            </a>
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
