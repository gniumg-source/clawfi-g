/**
 * ClawFi Clanker Overlay
 * 
 * Renders a shadow DOM overlay for Clanker token pages.
 * Shows token info, metadata, ClawFi signals, and Assist Mode.
 * 
 * Design: Apple Liquid Glass (iOS 26 / macOS Tahoe)
 */

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

interface Signal {
  id: string;
  ts: number;
  severity: string;
  signalType?: string;
  title: string;
  summary: string;
  recommendedAction: string;
}

interface RiskBadges {
  hasLaunch: boolean;
  hasConcentration: boolean;
  hasLiquidityRisk: boolean;
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

interface AssistAction {
  id: string;
  label: string;
  icon: string;
  description: string;
  type: 'link' | 'action' | 'copy';
  url?: string;
  value?: string;
}

interface OverlayState {
  metadata: ClankerTokenMetadata;
  signals: Signal[];
  badges: RiskBadges;
  marketData: MarketData | null;
  loading: boolean;
  error: string | null;
  expanded: boolean;
  closed: boolean;
  assistModeOpen: boolean;
  activeTab: 'signals' | 'market' | 'assist';
}

const SHADOW_HOST_ID = 'clawfi-clanker-overlay';
const BASESCAN_URL = 'https://basescan.org/address/';
const VERSION = '0.3.1';

let shadowHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let state: OverlayState | null = null;

/**
 * Format address for display
 */
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format market numbers (1000 -> 1K, 1000000 -> 1M)
 */
function formatMarketNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

/**
 * Get severity color - iOS system colors
 */
function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#FF453A',
    high: '#FF9F0A',
    medium: '#FFD60A',
    low: '#0A84FF',
  };
  return colors[severity] || colors.low;
}

/**
 * Generate Assist Mode actions for token
 */
function getAssistActions(metadata: ClankerTokenMetadata): AssistAction[] {
  const actions: AssistAction[] = [
    {
      id: 'copy-address',
      label: 'Copy Address',
      icon: '📋',
      description: 'Copy token contract address',
      type: 'copy',
      value: metadata.address,
    },
    {
      id: 'dexscreener',
      label: 'DEXScreener',
      icon: '📊',
      description: 'View charts and analytics',
      type: 'link',
      url: `https://dexscreener.com/base/${metadata.address}`,
    },
    {
      id: 'uniswap',
      label: 'Swap on Uniswap',
      icon: '🦄',
      description: 'Trade on Uniswap V3',
      type: 'link',
      url: `https://app.uniswap.org/swap?chain=base&outputCurrency=${metadata.address}`,
    },
    {
      id: 'basescan',
      label: 'View on Basescan',
      icon: '🔍',
      description: 'Contract & transactions',
      type: 'link',
      url: `${BASESCAN_URL}${metadata.address}`,
    },
    {
      id: 'gecko',
      label: 'CoinGecko',
      icon: '🦎',
      description: 'Market data & info',
      type: 'link',
      url: `https://www.coingecko.com/en/coins/${metadata.address}`,
    },
    {
      id: 'defined',
      label: 'Defined.fi',
      icon: '📈',
      description: 'Advanced analytics',
      type: 'link',
      url: `https://www.defined.fi/base/${metadata.address}`,
    },
  ];
  
  if (metadata.creator) {
    actions.push({
      id: 'copy-creator',
      label: 'Copy Creator',
      icon: '👤',
      description: 'Copy creator wallet address',
      type: 'copy',
      value: metadata.creator,
    });
  }
  
  return actions;
}

/**
 * Generate overlay styles - Apple Liquid Glass Design System
 */
function getOverlayStyles(): string {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* ============================================
       iOS LIQUID GLASS DESIGN TOKENS
       ============================================ */
    
    .clawfi-overlay {
      --glass-bg: rgba(255, 255, 255, 0.08);
      --glass-bg-elevated: rgba(255, 255, 255, 0.12);
      --glass-border: rgba(255, 255, 255, 0.18);
      --glass-blur: 40px;
      --glass-blur-heavy: 60px;
      
      /* iOS System Colors */
      --blue: #0A84FF;
      --green: #30D158;
      --red: #FF453A;
      --orange: #FF9F0A;
      --yellow: #FFD60A;
      --purple: #BF5AF2;
      --teal: #64D2FF;
      --pink: #FF375F;
      
      /* Text colors */
      --text-primary: rgba(255, 255, 255, 0.95);
      --text-secondary: rgba(255, 255, 255, 0.6);
      --text-tertiary: rgba(255, 255, 255, 0.4);
      
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    
    /* ============================================
       FLOATING ACTION BUTTON - iOS App Icon Style
       ============================================ */
    
    .clawfi-fab {
      width: 60px;
      height: 60px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(10, 132, 255, 0.9) 0%, rgba(10, 100, 200, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 
        0 10px 40px rgba(10, 132, 255, 0.4),
        0 2px 10px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    /* Specular highlight */
    .clawfi-fab::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 30%, transparent 50%);
      pointer-events: none;
      border-radius: inherit;
    }
    
    .clawfi-fab:hover {
      transform: scale(1.08) translateY(-3px);
      box-shadow: 
        0 16px 50px rgba(10, 132, 255, 0.5),
        0 4px 15px rgba(0, 0, 0, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }
    
    .clawfi-fab:active {
      transform: scale(0.98);
    }
    
    .clawfi-fab-icon {
      font-size: 28px;
      position: relative;
      z-index: 1;
    }
    
    .clawfi-fab-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 22px;
      height: 22px;
      border-radius: 11px;
      background: var(--red);
      color: white;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      box-shadow: 0 2px 8px rgba(255, 69, 58, 0.5);
      z-index: 2;
    }
    
    .clawfi-fab-risk {
      animation: pulse-risk 2s ease-in-out infinite;
    }
    
    .clawfi-fab-risk-dot {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 12px;
      height: 12px;
      background: var(--red);
      border-radius: 50%;
      box-shadow: 0 0 12px var(--red);
      z-index: 2;
    }
    
    @keyframes pulse-risk {
      0%, 100% { box-shadow: 0 10px 40px rgba(255, 69, 58, 0.3); }
      50% { box-shadow: 0 10px 50px rgba(255, 69, 58, 0.5); }
    }
    
    /* ============================================
       PANEL - iOS Sheet Style
       ============================================ */
    
    .clawfi-panel {
      width: 380px;
      background: rgba(30, 30, 40, 0.75);
      backdrop-filter: blur(var(--glass-blur-heavy)) saturate(200%);
      -webkit-backdrop-filter: blur(var(--glass-blur-heavy)) saturate(200%);
      border-radius: 24px;
      border: 1px solid var(--glass-border);
      box-shadow: 
        0 25px 80px rgba(0, 0, 0, 0.5),
        0 10px 30px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      overflow: hidden;
      animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    /* ============================================
       HEADER - iOS Navigation Bar Style
       ============================================ */
    
    .clawfi-header {
      padding: 18px 20px;
      background: linear-gradient(180deg, rgba(10, 132, 255, 0.85) 0%, rgba(10, 100, 200, 0.9) 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    }
    
    /* Specular highlight on header */
    .clawfi-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 70%);
      pointer-events: none;
    }
    
    .clawfi-header-title {
      font-weight: 600;
      color: white;
      font-size: 17px;
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
      z-index: 1;
      letter-spacing: -0.3px;
    }
    
    .clawfi-header-actions {
      display: flex;
      gap: 10px;
      position: relative;
      z-index: 1;
    }
    
    .clawfi-header-btn {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s ease;
    }
    
    .clawfi-header-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }
    
    /* ============================================
       TAB BAR - iOS Segmented Control
       ============================================ */
    
    .clawfi-tabs {
      display: flex;
      padding: 12px 16px;
      gap: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .clawfi-tab {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .clawfi-tab:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .clawfi-tab.active {
      background: rgba(10, 132, 255, 0.3);
      color: white;
      border-color: rgba(10, 132, 255, 0.5);
    }
    
    .clawfi-tab-icon {
      font-size: 14px;
    }
    
    .clawfi-tab-badge {
      background: var(--red);
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
    }
    
    /* ============================================
       BODY - iOS List Style
       ============================================ */
    
    .clawfi-body {
      max-height: 380px;
      overflow-y: auto;
    }
    
    .clawfi-body::-webkit-scrollbar {
      width: 6px;
    }
    
    .clawfi-body::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .clawfi-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
    }
    
    /* ============================================
       SECTIONS - iOS Grouped Table Style
       ============================================ */
    
    .clawfi-section {
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    
    .clawfi-section:last-child {
      border-bottom: none;
    }
    
    .clawfi-section-title {
      font-size: 11px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 14px;
      font-weight: 600;
    }
    
    .clawfi-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .clawfi-row:last-child {
      margin-bottom: 0;
    }
    
    .clawfi-row-label {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .clawfi-row-value {
      color: var(--text-primary);
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* ============================================
       ADDRESS CHIP - iOS Style
       ============================================ */
    
    .clawfi-address {
      font-family: 'SF Mono', 'Menlo', Monaco, monospace;
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px);
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      letter-spacing: 0.02em;
    }
    
    .clawfi-copy-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 12px;
      transition: all 0.2s ease;
    }
    
    .clawfi-copy-btn:hover {
      color: var(--blue);
      background: rgba(10, 132, 255, 0.15);
      border-color: rgba(10, 132, 255, 0.3);
    }
    
    /* ============================================
       MARKET DATA GRID - Dexscreener
       ============================================ */
    
    .clawfi-market-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    
    .clawfi-market-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.2s ease;
    }
    
    .clawfi-market-card:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
    }
    
    .clawfi-market-label {
      font-size: 10px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    
    .clawfi-market-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .clawfi-market-sub {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    
    .clawfi-market-change {
      font-size: 12px;
      font-weight: 500;
      margin-top: 2px;
    }
    
    .clawfi-market-change.positive {
      color: var(--green);
    }
    
    .clawfi-market-change.negative {
      color: var(--red);
    }
    
    .clawfi-dexscreener-link {
      color: var(--blue);
      text-decoration: none;
      font-size: 11px;
      display: inline-block;
      margin-top: 4px;
    }
    
    .clawfi-dexscreener-link:hover {
      text-decoration: underline;
    }
    
    /* ============================================
       BADGES - iOS Pill Style
       ============================================ */
    
    .clawfi-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 500;
      backdrop-filter: blur(10px);
    }
    
    .clawfi-badge-base {
      background: rgba(10, 132, 255, 0.2);
      color: var(--teal);
      border: 1px solid rgba(10, 132, 255, 0.35);
    }
    
    .clawfi-badge-version {
      background: rgba(191, 90, 242, 0.2);
      color: #D4A5FF;
      border: 1px solid rgba(191, 90, 242, 0.35);
    }
    
    .clawfi-badge-verified {
      background: rgba(48, 209, 88, 0.2);
      color: var(--green);
      border: 1px solid rgba(48, 209, 88, 0.35);
    }
    
    .clawfi-badges-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    /* Alert badges */
    .clawfi-alert-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    }
    
    .clawfi-alert-badge:hover {
      transform: scale(1.05);
    }
    
    .clawfi-alert-launch {
      background: rgba(48, 209, 88, 0.2);
      color: var(--green);
      border: 1px solid rgba(48, 209, 88, 0.35);
    }
    
    .clawfi-alert-concentration {
      background: rgba(255, 159, 10, 0.2);
      color: var(--orange);
      border: 1px solid rgba(255, 159, 10, 0.35);
    }
    
    .clawfi-alert-liquidity {
      background: rgba(255, 69, 58, 0.2);
      color: var(--red);
      border: 1px solid rgba(255, 69, 58, 0.35);
    }
    
    /* ============================================
       LINKS - iOS Style
       ============================================ */
    
    .clawfi-link {
      color: var(--blue);
      text-decoration: none;
      transition: opacity 0.2s;
    }
    
    .clawfi-link:hover {
      opacity: 0.7;
    }
    
    /* ============================================
       SIGNALS LIST - iOS Cell Style
       ============================================ */
    
    .clawfi-signals-empty {
      padding: 32px;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 14px;
    }
    
    .clawfi-signal {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      transition: background 0.2s ease;
    }
    
    .clawfi-signal:last-child {
      border-bottom: none;
    }
    
    .clawfi-signal:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    
    .clawfi-signal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    
    .clawfi-signal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 8px currentColor;
    }
    
    .clawfi-signal-title {
      color: var(--text-primary);
      font-weight: 500;
      font-size: 14px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .clawfi-signal-summary {
      color: var(--text-secondary);
      font-size: 13px;
      margin-left: 22px;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.5;
    }
    
    .clawfi-signal-meta {
      color: var(--text-tertiary);
      font-size: 12px;
      margin-left: 22px;
    }
    
    /* ============================================
       ASSIST MODE - Action Cards
       ============================================ */
    
    .clawfi-assist-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 16px 20px;
    }
    
    .clawfi-assist-action {
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      display: block;
    }
    
    .clawfi-assist-action:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(10, 132, 255, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    
    .clawfi-assist-action-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    .clawfi-assist-action-label {
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 2px;
    }
    
    .clawfi-assist-action-desc {
      color: var(--text-tertiary);
      font-size: 11px;
    }
    
    .clawfi-assist-warning {
      margin: 0 20px 16px;
      padding: 14px 16px;
      background: rgba(255, 159, 10, 0.15);
      border: 1px solid rgba(255, 159, 10, 0.3);
      border-radius: 12px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    
    .clawfi-assist-warning-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .clawfi-assist-warning-text {
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.5;
    }
    
    .clawfi-assist-warning strong {
      color: var(--orange);
    }
    
    /* ============================================
       LOADING STATE - iOS Activity Indicator
       ============================================ */
    
    .clawfi-loading {
      padding: 32px;
      text-align: center;
      color: var(--text-tertiary);
    }
    
    .clawfi-loading-spinner {
      width: 30px;
      height: 30px;
      border: 2.5px solid rgba(255, 255, 255, 0.1);
      border-top-color: var(--blue);
      border-radius: 50%;
      animation: clawfi-spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes clawfi-spin {
      to { transform: rotate(360deg); }
    }
    
    /* ============================================
       ERROR STATE - iOS Alert Style
       ============================================ */
    
    .clawfi-error {
      padding: 18px;
      background: rgba(255, 69, 58, 0.15);
      border: 1px solid rgba(255, 69, 58, 0.3);
      border-radius: 16px;
      margin: 16px 20px;
      backdrop-filter: blur(10px);
    }
    
    .clawfi-error-text {
      color: #FF8A80;
      font-size: 13px;
      margin-bottom: 14px;
    }
    
    .clawfi-retry-btn {
      background: rgba(255, 69, 58, 0.3);
      color: white;
      border: 1px solid rgba(255, 69, 58, 0.5);
      padding: 10px 18px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .clawfi-retry-btn:hover {
      background: rgba(255, 69, 58, 0.4);
      transform: scale(1.02);
    }
    
    /* ============================================
       FOOTER - iOS Toolbar Style
       ============================================ */
    
    .clawfi-footer {
      padding: 14px 20px;
      background: rgba(255, 255, 255, 0.03);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .clawfi-footer-text {
      color: var(--text-tertiary);
      font-size: 11px;
    }
    
    /* ============================================
       BUTTONS - iOS Liquid Glass Style
       ============================================ */
    
    .clawfi-dashboard-btn {
      background: rgba(10, 132, 255, 0.5);
      color: white;
      border: 1px solid rgba(10, 132, 255, 0.6);
      padding: 10px 18px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }
    
    .clawfi-dashboard-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%);
      pointer-events: none;
    }
    
    .clawfi-dashboard-btn:hover {
      background: rgba(10, 132, 255, 0.65);
      transform: scale(1.03);
      box-shadow: 0 4px 16px rgba(10, 132, 255, 0.4);
    }
    
    /* ============================================
       SUCCESS TOAST
       ============================================ */
    
    .clawfi-toast {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(48, 209, 88, 0.9);
      backdrop-filter: blur(20px);
      color: white;
      padding: 12px 24px;
      border-radius: 100px;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483648;
      animation: toastIn 0.3s ease, toastOut 0.3s ease 1.7s forwards;
      box-shadow: 0 8px 32px rgba(48, 209, 88, 0.4);
    }
    
    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    @keyframes toastOut {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
    }
  `;
}

/**
 * Generate overlay HTML
 */
function generateOverlayHTML(state: OverlayState): string {
  const { metadata, signals, badges, loading, error, expanded, closed, activeTab } = state;
  
  if (closed) {
    return '';
  }
  
  // Count active risk badges for FAB indicator
  const riskCount = [badges.hasConcentration, badges.hasLiquidityRisk].filter(Boolean).length;
  
  if (!expanded) {
    // Collapsed FAB with risk indicator
    return `
      <div class="clawfi-overlay">
        <button class="clawfi-fab ${riskCount > 0 ? 'clawfi-fab-risk' : ''}" data-action="expand">
          <span class="clawfi-fab-icon">🦀</span>
          ${signals.length > 0 ? `<span class="clawfi-fab-badge">${signals.length}</span>` : ''}
          ${riskCount > 0 ? `<span class="clawfi-fab-risk-dot"></span>` : ''}
        </button>
      </div>
    `;
  }
  
  // Generate tab content based on active tab
  let tabContent = '';
  
  if (activeTab === 'signals') {
    if (loading) {
      tabContent = `
        <div class="clawfi-loading">
          <div class="clawfi-loading-spinner"></div>
          <div>Loading signals...</div>
        </div>
      `;
    } else if (error) {
      tabContent = `
        <div class="clawfi-error">
          <div class="clawfi-error-text">${error}</div>
          <button class="clawfi-retry-btn" data-action="retry">Retry</button>
        </div>
      `;
    } else if (signals.length === 0) {
      tabContent = `
        <div class="clawfi-signals-empty">
          <div style="font-size: 32px; margin-bottom: 12px;">✨</div>
          <div>No signals detected</div>
          <div style="font-size: 12px; margin-top: 4px; color: var(--text-tertiary);">This token appears clean</div>
        </div>
      `;
    } else {
      tabContent = signals.map(signal => `
        <div class="clawfi-signal">
          <div class="clawfi-signal-header">
            <span class="clawfi-signal-dot" style="background: ${getSeverityColor(signal.severity)}; color: ${getSeverityColor(signal.severity)}"></span>
            <span class="clawfi-signal-title">${escapeHtml(signal.title)}</span>
          </div>
          <div class="clawfi-signal-summary">${escapeHtml(signal.summary.slice(0, 120))}${signal.summary.length > 120 ? '...' : ''}</div>
          <div class="clawfi-signal-meta">${formatRelativeTime(signal.ts)} • ${signal.recommendedAction.replace(/_/g, ' ')}</div>
        </div>
      `).join('');
    }
  } else if (activeTab === 'market') {
    if (state.marketData) {
      tabContent = `
        <div class="clawfi-section">
          <div class="clawfi-section-title">Live Market Data</div>
          <div class="clawfi-market-grid">
            <div class="clawfi-market-card">
              <div class="clawfi-market-label">Price</div>
              <div class="clawfi-market-value">$${state.marketData.priceUsd < 0.01 ? state.marketData.priceUsd.toExponential(2) : state.marketData.priceUsd.toFixed(4)}</div>
              <div class="clawfi-market-change ${state.marketData.priceChange24h >= 0 ? 'positive' : 'negative'}">
                ${state.marketData.priceChange24h >= 0 ? '+' : ''}${state.marketData.priceChange24h.toFixed(2)}% (24h)
              </div>
            </div>
            <div class="clawfi-market-card">
              <div class="clawfi-market-label">Volume 24h</div>
              <div class="clawfi-market-value">$${formatMarketNumber(state.marketData.volume24h)}</div>
              <div class="clawfi-market-sub">${state.marketData.txns24h.buys}↑ ${state.marketData.txns24h.sells}↓</div>
            </div>
            <div class="clawfi-market-card">
              <div class="clawfi-market-label">Liquidity</div>
              <div class="clawfi-market-value">$${formatMarketNumber(state.marketData.liquidity)}</div>
              <div class="clawfi-market-sub">${state.marketData.dex}</div>
            </div>
            <div class="clawfi-market-card">
              <div class="clawfi-market-label">Market Cap</div>
              <div class="clawfi-market-value">${state.marketData.marketCap ? '$' + formatMarketNumber(state.marketData.marketCap) : 'N/A'}</div>
              <a class="clawfi-dexscreener-link" href="${state.marketData.dexscreenerUrl}" target="_blank">View on DEXScreener ↗</a>
            </div>
          </div>
        </div>
        
        <div class="clawfi-section">
          <div class="clawfi-section-title">Token Info</div>
          <div class="clawfi-row">
            <span class="clawfi-row-label">Address</span>
            <span class="clawfi-row-value">
              <code class="clawfi-address">${formatAddress(metadata.address)}</code>
              <button class="clawfi-copy-btn" data-action="copy" data-value="${metadata.address}">📋</button>
            </span>
          </div>
          <div class="clawfi-row">
            <span class="clawfi-row-label">Chain</span>
            <span class="clawfi-row-value">
              <span class="clawfi-badge clawfi-badge-base">⬡ Base</span>
            </span>
          </div>
          ${metadata.version ? `
          <div class="clawfi-row">
            <span class="clawfi-row-label">Version</span>
            <span class="clawfi-row-value">
              <span class="clawfi-badge clawfi-badge-version">${metadata.version}</span>
            </span>
          </div>
          ` : ''}
        </div>
      `;
    } else {
      tabContent = `
        <div class="clawfi-signals-empty">
          <div style="font-size: 32px; margin-bottom: 12px;">📊</div>
          <div>Loading market data...</div>
          <div style="font-size: 12px; margin-top: 4px; color: var(--text-tertiary);">Fetching from DEXScreener</div>
        </div>
      `;
    }
  } else if (activeTab === 'assist') {
    const actions = getAssistActions(metadata);
    tabContent = `
      <div class="clawfi-assist-warning">
        <span class="clawfi-assist-warning-icon">⚡</span>
        <div class="clawfi-assist-warning-text">
          <strong>Assist Mode</strong> provides quick actions for this token. 
          ClawFi never signs transactions automatically — you always review first.
        </div>
      </div>
      
      <div class="clawfi-assist-grid">
        ${actions.map(action => {
          if (action.type === 'link') {
            return `
              <a class="clawfi-assist-action" href="${action.url}" target="_blank" rel="noopener">
                <div class="clawfi-assist-action-icon">${action.icon}</div>
                <div class="clawfi-assist-action-label">${action.label}</div>
                <div class="clawfi-assist-action-desc">${action.description}</div>
              </a>
            `;
          } else if (action.type === 'copy') {
            return `
              <button class="clawfi-assist-action" data-action="copy" data-value="${action.value}">
                <div class="clawfi-assist-action-icon">${action.icon}</div>
                <div class="clawfi-assist-action-label">${action.label}</div>
                <div class="clawfi-assist-action-desc">${action.description}</div>
              </button>
            `;
          }
          return '';
        }).join('')}
      </div>
    `;
  }
  
  return `
    <div class="clawfi-overlay">
      <div class="clawfi-panel">
        <div class="clawfi-header">
          <div class="clawfi-header-title">
            <span>🦀</span>
            <span>${metadata.symbol || metadata.name || 'ClawFi'}</span>
          </div>
          <div class="clawfi-header-actions">
            <button class="clawfi-header-btn" data-action="collapse" title="Minimize">−</button>
            <button class="clawfi-header-btn" data-action="close" title="Close">×</button>
          </div>
        </div>
        
        <div class="clawfi-tabs">
          <button class="clawfi-tab ${activeTab === 'signals' ? 'active' : ''}" data-tab="signals">
            <span class="clawfi-tab-icon">🚨</span>
            Signals
            ${signals.length > 0 ? `<span class="clawfi-tab-badge">${signals.length}</span>` : ''}
          </button>
          <button class="clawfi-tab ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
            <span class="clawfi-tab-icon">📊</span>
            Market
          </button>
          <button class="clawfi-tab ${activeTab === 'assist' ? 'active' : ''}" data-tab="assist">
            <span class="clawfi-tab-icon">⚡</span>
            Assist
          </button>
        </div>
        
        <div class="clawfi-body">
          ${tabContent}
        </div>
        
        <div class="clawfi-footer">
          <span class="clawfi-footer-text">ClawFi v${VERSION}</span>
          <a class="clawfi-dashboard-btn" data-action="dashboard">Open Dashboard</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message: string): void {
  if (!shadowRoot) return;
  
  // Remove existing toast
  const existing = shadowRoot.querySelector('.clawfi-toast');
  if (existing) existing.remove();
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = 'clawfi-toast';
  toast.textContent = message;
  shadowRoot.appendChild(toast);
  
  // Auto remove
  setTimeout(() => toast.remove(), 2000);
}

/**
 * Fetch signals from ClawFi Node
 */
async function fetchSignals(token: string): Promise<Signal[]> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: 'GET_SIGNALS', token, chain: 'base', limit: 5 },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[ClawFi] Signal fetch error:', chrome.runtime.lastError);
            resolve([]);
            return;
          }
          if (Array.isArray(response)) {
            resolve(response);
          } else {
            resolve([]);
          }
        }
      );
    } catch (err) {
      console.warn('[ClawFi] Signal fetch exception:', err);
      resolve([]);
    }
  });
}

/**
 * Fetch market data from Dexscreener via ClawFi API
 */
async function fetchMarketData(token: string): Promise<MarketData | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (settings) => {
        if (chrome.runtime.lastError || !settings) {
          resolve(null);
          return;
        }
        
        try {
          const nodeUrl = settings.nodeUrl || 'https://api.clawfi.ai';
          const response = await fetch(`${nodeUrl}/dexscreener/token/${token}?chain=base`, {
            headers: settings.authToken ? {
              'Authorization': `Bearer ${settings.authToken}`,
            } : {},
          });
          
          if (!response.ok) {
            resolve(null);
            return;
          }
          
          const data = await response.json();
          if (data.success && data.data) {
            resolve({
              priceUsd: data.data.priceUsd || 0,
              priceChange24h: data.data.priceChange24h || 0,
              priceChangeH1: data.data.priceChangeH1 || 0,
              volume24h: data.data.volume24h || 0,
              liquidity: data.data.liquidity || 0,
              marketCap: data.data.marketCap,
              txns24h: data.data.txns24h || { buys: 0, sells: 0 },
              dex: data.data.dex || 'unknown',
              dexscreenerUrl: data.data.dexscreenerUrl || '',
            });
          } else {
            resolve(null);
          }
        } catch (err) {
          console.warn('[ClawFi] Market data fetch error:', err);
          resolve(null);
        }
      });
    } catch (err) {
      console.warn('[ClawFi] Market data fetch exception:', err);
      resolve(null);
    }
  });
}

/**
 * Open dashboard
 */
async function openDashboard(): Promise<void> {
  let dashboardUrl = 'https://dashboard.clawfi.ai';
  
  if (state?.metadata.address) {
    dashboardUrl += `/signals?token=${state.metadata.address}`;
  }
  
  window.open(dashboardUrl, '_blank');
}

/**
 * Update overlay render
 */
function render(): void {
  if (!shadowRoot || !state) return;
  
  shadowRoot.innerHTML = `
    <style>${getOverlayStyles()}</style>
    ${generateOverlayHTML(state)}
  `;
  
  // Attach event listeners
  attachEventListeners();
}

/**
 * Attach event listeners to overlay elements
 */
function attachEventListeners(): void {
  if (!shadowRoot) return;
  
  // Expand FAB
  const fab = shadowRoot.querySelector('[data-action="expand"]');
  fab?.addEventListener('click', () => {
    if (state) {
      state.expanded = true;
      render();
    }
  });
  
  // Collapse panel
  const collapseBtn = shadowRoot.querySelector('[data-action="collapse"]');
  collapseBtn?.addEventListener('click', () => {
    if (state) {
      state.expanded = false;
      render();
    }
  });
  
  // Close panel
  const closeBtn = shadowRoot.querySelector('[data-action="close"]');
  closeBtn?.addEventListener('click', () => {
    if (state) {
      state.closed = true;
      render();
    }
  });
  
  // Tab switching
  const tabs = shadowRoot.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (state) {
        const tabId = (tab as HTMLElement).dataset.tab as 'signals' | 'market' | 'assist';
        state.activeTab = tabId;
        render();
      }
    });
  });
  
  // Copy buttons
  const copyBtns = shadowRoot.querySelectorAll('[data-action="copy"]');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = (e.currentTarget as HTMLElement).dataset.value;
      if (value) {
        await copyToClipboard(value);
        showToast('Copied to clipboard!');
      }
    });
  });
  
  // Retry button
  const retryBtn = shadowRoot.querySelector('[data-action="retry"]');
  retryBtn?.addEventListener('click', async () => {
    if (state) {
      state.loading = true;
      state.error = null;
      render();
      
      try {
        const signals = await fetchSignals(state.metadata.address);
        state.signals = signals;
        state.loading = false;
      } catch {
        state.error = 'Failed to connect to ClawFi Node';
        state.loading = false;
      }
      render();
    }
  });
  
  // Dashboard button
  const dashboardBtn = shadowRoot.querySelector('[data-action="dashboard"]');
  dashboardBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openDashboard();
  });
}

/**
 * Calculate risk badges from signals
 */
function calculateBadges(signals: Signal[]): RiskBadges {
  return {
    hasLaunch: signals.some(s => s.signalType === 'LaunchDetected'),
    hasConcentration: signals.some(s => s.signalType === 'EarlyDistribution'),
    hasLiquidityRisk: signals.some(s => s.signalType === 'LiquidityRisk'),
  };
}

export async function renderClankerOverlay(metadata: ClankerTokenMetadata): Promise<void> {
  // Create shadow host if doesn't exist
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = SHADOW_HOST_ID;
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
  }
  
  // Initialize state with default badges
  state = {
    metadata,
    signals: [],
    badges: { hasLaunch: false, hasConcentration: false, hasLiquidityRisk: false },
    marketData: null,
    loading: true,
    error: null,
    expanded: false,
    closed: false,
    assistModeOpen: false,
    activeTab: 'signals',
  };
  
  // Initial render
  render();
  
  // Fetch signals and market data in parallel
  try {
    const [signals, marketData] = await Promise.all([
      fetchSignals(metadata.address),
      fetchMarketData(metadata.address),
    ]);
    
    if (state && state.metadata.address === metadata.address) {
      state.signals = signals;
      state.badges = calculateBadges(signals);
      state.marketData = marketData;
      state.loading = false;
      render();
    }
  } catch (error) {
    if (state && state.metadata.address === metadata.address) {
      state.error = 'Unable to reach ClawFi Node';
      state.loading = false;
      render();
    }
  }
}

/**
 * Unmount the overlay
 */
export function unmountClankerOverlay(): void {
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
    shadowRoot = null;
    state = null;
  }
}
