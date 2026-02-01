/**
 * ClawFi Extension - Content Script
 * 
 * Detects token addresses on supported pages and shows overlay with signals
 * Supports: Dexscreener, Etherscan, Basescan, Arbiscan, Uniswap
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

console.log('[ClawFi] General content script loaded on:', window.location.href);

// Ethereum address regex
const ETH_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

// Chain detection from URL
function detectChain(url: string): string | undefined {
  const urlLower = url.toLowerCase();
  
  // Etherscan variants
  if (urlLower.includes('etherscan.io')) return 'ethereum';
  if (urlLower.includes('arbiscan.io')) return 'arbitrum';
  if (urlLower.includes('basescan.org')) return 'base';
  if (urlLower.includes('bscscan.com')) return 'bsc';
  
  // Dexscreener - chain is in the path
  if (urlLower.includes('dexscreener.com')) {
    const pathMatch = url.match(/dexscreener\.com\/([^\/]+)/i);
    if (pathMatch && pathMatch[1]) {
      const chain = pathMatch[1].toLowerCase();
      if (chain === 'ethereum' || chain === 'eth') return 'ethereum';
      if (chain === 'base') return 'base';
      if (chain === 'arbitrum') return 'arbitrum';
      if (chain === 'bsc') return 'bsc';
      if (chain === 'polygon') return 'polygon';
      if (chain === 'solana') return 'solana';
      return chain; // Return as-is for other chains
    }
  }
  
  // Uniswap
  if (urlLower.includes('uniswap.org')) {
    if (urlLower.includes('chain=1') || urlLower.includes('chain=mainnet')) return 'ethereum';
    if (urlLower.includes('chain=8453') || urlLower.includes('chain=base')) return 'base';
    if (urlLower.includes('chain=42161') || urlLower.includes('chain=arbitrum')) return 'arbitrum';
    return 'ethereum'; // Default
  }
  
  return undefined;
}

// Detect token address from page
function detectTokenAddress(): string | null {
  const url = window.location.href;
  
  console.log('[ClawFi] Detecting token from URL:', url);
  
  // Dexscreener: https://dexscreener.com/base/0x...
  if (url.includes('dexscreener.com')) {
    const dexMatch = url.match(/dexscreener\.com\/[^\/]+\/(0x[a-fA-F0-9]{40})/i);
    if (dexMatch && dexMatch[1]) {
      console.log('[ClawFi] Dexscreener token detected:', dexMatch[1]);
      return dexMatch[1];
    }
  }
  
  // Try URL first (for etherscan, basescan, etc)
  const urlMatch = url.match(ETH_ADDRESS_REGEX);
  if (urlMatch) {
    console.log('[ClawFi] Token from URL:', urlMatch[0]);
    return urlMatch[0]!;
  }
  
  // Try page content as fallback
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
        console.log('[ClawFi] Token from page content:', addr);
        return addr;
      }
    }
  }
  
  console.log('[ClawFi] No token detected');
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

interface MarketData {
  priceUsd: number;
  priceChange24h: number;
  priceChangeH1: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  txns24h: { buys: number; sells: number };
  dex: string;
  dexscreenerUrl: string;
}

// Fetch market data from Dexscreener via ClawFi API
async function fetchMarketData(token: string, chain?: string, settings?: Settings): Promise<MarketData | null> {
  try {
    const nodeUrl = settings?.nodeUrl || 'https://api.clawfi.ai';
    const chainParam = chain ? `?chain=${chain}` : '';
    const response = await fetch(`${nodeUrl}/dexscreener/token/${token}${chainParam}`, {
      headers: settings?.authToken ? {
        'Authorization': `Bearer ${settings.authToken}`,
      } : {},
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.success && data.data) {
      return {
        priceUsd: data.data.priceUsd,
        priceChange24h: data.data.priceChange24h,
        priceChangeH1: data.data.priceChangeH1,
        volume24h: data.data.volume24h,
        liquidity: data.data.liquidity,
        marketCap: data.data.marketCap,
        txns24h: data.data.txns24h,
        dex: data.data.dex,
        dexscreenerUrl: data.data.dexscreenerUrl,
      };
    }
    return null;
  } catch (error) {
    console.error('[ClawFi] Failed to fetch market data:', error);
    return null;
  }
}

// Overlay component
function ClawFiOverlay() {
  const [token, setToken] = useState<string | null>(null);
  const [chain, setChain] = useState<string | undefined>();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    // Check settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s: Settings) => {
      setEnabled(s.overlayEnabled);
      setSettings(s);
    });

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
      
      // Fetch market data from Dexscreener
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (s: Settings) => {
        const md = await fetchMarketData(detectedToken, detectedChain, s);
        setMarketData(md);
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

  const severityColor: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
  };

  // Liquid Glass styles
  const glassStyle: React.CSSProperties = {
    background: 'rgba(30, 30, 40, 0.75)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
      }}
    >
      {/* Collapsed FAB - iOS App Icon style */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(145deg, #0A84FF 0%, #0066CC 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(10, 132, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            position: 'relative',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '26px' }}>🦀</span>
          {signals.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                minWidth: '22px',
                height: '22px',
                borderRadius: '11px',
                background: '#FF453A',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                boxShadow: '0 2px 8px rgba(255, 69, 58, 0.5)',
              }}
            >
              {signals.length}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel - iOS Sheet style */}
      {expanded && (
        <div
          style={{
            width: '340px',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.3)',
            ...glassStyle,
          }}
        >
          {/* Header - Blue gradient like iOS */}
          <div
            style={{
              padding: '16px 18px',
              background: 'linear-gradient(180deg, rgba(10, 132, 255, 0.9) 0%, rgba(10, 100, 200, 0.95) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
              <span style={{ fontSize: '20px' }}>🦀</span>
              <span style={{ fontWeight: '600', color: 'white', fontSize: '16px', letterSpacing: '-0.3px' }}>
                ClawFi
              </span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: 'white',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Token info */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code
                  style={{
                    fontSize: '13px',
                    color: 'white',
                    background: 'rgba(255, 255, 255, 0.1)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {formatAddress(token)}
                </code>
                {chain && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#0A84FF',
                      background: 'rgba(10, 132, 255, 0.15)',
                      padding: '4px 10px',
                      borderRadius: '100px',
                      border: '1px solid rgba(10, 132, 255, 0.3)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {chain}
                  </span>
                )}
              </div>
            </div>
            
            {/* Market Data from Dexscreener */}
            {marketData && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '8px',
                marginTop: '12px',
              }}>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '10px', 
                  padding: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>PRICE</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>
                    ${marketData.priceUsd < 0.01 ? marketData.priceUsd.toExponential(2) : marketData.priceUsd.toFixed(4)}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: marketData.priceChange24h >= 0 ? '#30D158' : '#FF453A',
                    marginTop: '2px',
                  }}>
                    {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h.toFixed(2)}% (24h)
                  </div>
                </div>
                
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '10px', 
                  padding: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>VOLUME 24H</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>
                    ${marketData.volume24h >= 1000000 
                      ? (marketData.volume24h / 1000000).toFixed(2) + 'M'
                      : marketData.volume24h >= 1000 
                        ? (marketData.volume24h / 1000).toFixed(1) + 'K'
                        : marketData.volume24h.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                    {marketData.txns24h.buys}↑ {marketData.txns24h.sells}↓
                  </div>
                </div>
                
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '10px', 
                  padding: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>LIQUIDITY</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>
                    ${marketData.liquidity >= 1000000 
                      ? (marketData.liquidity / 1000000).toFixed(2) + 'M'
                      : marketData.liquidity >= 1000 
                        ? (marketData.liquidity / 1000).toFixed(1) + 'K'
                        : marketData.liquidity.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                    {marketData.dex}
                  </div>
                </div>
                
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '10px', 
                  padding: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>MCAP</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>
                    {marketData.marketCap 
                      ? `$${marketData.marketCap >= 1000000 
                          ? (marketData.marketCap / 1000000).toFixed(2) + 'M'
                          : marketData.marketCap >= 1000 
                            ? (marketData.marketCap / 1000).toFixed(1) + 'K'
                            : marketData.marketCap.toFixed(0)}`
                      : 'N/A'}
                  </div>
                  <a 
                    href={marketData.dexscreenerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: '#0A84FF', textDecoration: 'none', marginTop: '2px', display: 'block' }}
                  >
                    View on DEXScreener ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Signals */}
          <div style={{ maxHeight: '260px', overflow: 'auto' }}>
            {loading ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                }}
              >
                <div style={{ marginBottom: '8px' }}>⏳</div>
                Loading signals...
              </div>
            ) : signals.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                }}
              >
                <div style={{ marginBottom: '8px', fontSize: '24px' }}>✨</div>
                No signals for this token
              </div>
            ) : (
              signals.map((signal) => (
                <div
                  key={signal.id}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    transition: 'background 0.2s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '4px',
                        background: severityColor[signal.severity] || '#0A84FF',
                        boxShadow: `0 0 8px ${severityColor[signal.severity] || '#0A84FF'}`,
                      }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>
                      {signal.title}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.6)',
                      margin: '0 0 6px 18px',
                      lineHeight: '1.5',
                    }}
                  >
                    {signal.summary.slice(0, 100)}
                    {signal.summary.length > 100 ? '...' : ''}
                  </p>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      marginLeft: '18px',
                    }}
                  >
                    {formatTime(signal.ts)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 18px',
              background: 'rgba(0, 0, 0, 0.2)',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            ClawFi v0.3.0 • <span style={{ color: '#0A84FF', cursor: 'pointer' }} onClick={() => chrome.runtime.openOptionsPage()}>Settings</span>
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


