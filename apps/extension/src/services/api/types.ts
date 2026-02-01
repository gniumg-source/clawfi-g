/**
 * ClawFi Extension - Unified API Types
 * 
 * Shared types for all DeFi data sources
 */

// ============================================
// CHAIN TYPES
// ============================================

export type ChainId = 
  | 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'polygon' | 'bsc' | 'avalanche'
  | 'solana' | 'sui' | 'aptos'
  | 'fantom' | 'cronos' | 'moonbeam' | 'celo' | 'gnosis';

export interface ChainInfo {
  id: ChainId;
  name: string;
  symbol: string;
  icon: string;
  explorerUrl: string;
  dexscreenerId: string;
  geckoTerminalId: string;
  coingeckoId: string;
  chainIdHex?: string;
  rpcUrl?: string;
}

export const CHAINS: Record<ChainId, ChainInfo> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    icon: '⟠',
    explorerUrl: 'https://etherscan.io',
    dexscreenerId: 'ethereum',
    geckoTerminalId: 'eth',
    coingeckoId: 'ethereum',
    chainIdHex: '0x1',
  },
  base: {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    icon: '⬡',
    explorerUrl: 'https://basescan.org',
    dexscreenerId: 'base',
    geckoTerminalId: 'base',
    coingeckoId: 'base',
    chainIdHex: '0x2105',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    icon: '◈',
    explorerUrl: 'https://arbiscan.io',
    dexscreenerId: 'arbitrum',
    geckoTerminalId: 'arbitrum',
    coingeckoId: 'arbitrum-one',
    chainIdHex: '0xa4b1',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    icon: '🔴',
    explorerUrl: 'https://optimistic.etherscan.io',
    dexscreenerId: 'optimism',
    geckoTerminalId: 'optimism',
    coingeckoId: 'optimistic-ethereum',
    chainIdHex: '0xa',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    icon: '⬣',
    explorerUrl: 'https://polygonscan.com',
    dexscreenerId: 'polygon',
    geckoTerminalId: 'polygon_pos',
    coingeckoId: 'polygon-pos',
    chainIdHex: '0x89',
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Chain',
    symbol: 'BNB',
    icon: '⬢',
    explorerUrl: 'https://bscscan.com',
    dexscreenerId: 'bsc',
    geckoTerminalId: 'bsc',
    coingeckoId: 'binance-smart-chain',
    chainIdHex: '0x38',
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche',
    symbol: 'AVAX',
    icon: '🔺',
    explorerUrl: 'https://snowtrace.io',
    dexscreenerId: 'avalanche',
    geckoTerminalId: 'avax',
    coingeckoId: 'avalanche',
    chainIdHex: '0xa86a',
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    icon: '◎',
    explorerUrl: 'https://solscan.io',
    dexscreenerId: 'solana',
    geckoTerminalId: 'solana',
    coingeckoId: 'solana',
  },
  sui: {
    id: 'sui',
    name: 'Sui',
    symbol: 'SUI',
    icon: '💧',
    explorerUrl: 'https://suiscan.xyz',
    dexscreenerId: 'sui',
    geckoTerminalId: 'sui-network',
    coingeckoId: 'sui',
  },
  aptos: {
    id: 'aptos',
    name: 'Aptos',
    symbol: 'APT',
    icon: '🌀',
    explorerUrl: 'https://aptoscan.com',
    dexscreenerId: 'aptos',
    geckoTerminalId: 'aptos',
    coingeckoId: 'aptos',
  },
  fantom: {
    id: 'fantom',
    name: 'Fantom',
    symbol: 'FTM',
    icon: '👻',
    explorerUrl: 'https://ftmscan.com',
    dexscreenerId: 'fantom',
    geckoTerminalId: 'ftm',
    coingeckoId: 'fantom',
    chainIdHex: '0xfa',
  },
  cronos: {
    id: 'cronos',
    name: 'Cronos',
    symbol: 'CRO',
    icon: '🌐',
    explorerUrl: 'https://cronoscan.com',
    dexscreenerId: 'cronos',
    geckoTerminalId: 'cronos',
    coingeckoId: 'cronos',
    chainIdHex: '0x19',
  },
  moonbeam: {
    id: 'moonbeam',
    name: 'Moonbeam',
    symbol: 'GLMR',
    icon: '🌙',
    explorerUrl: 'https://moonbeam.moonscan.io',
    dexscreenerId: 'moonbeam',
    geckoTerminalId: 'moonbeam',
    coingeckoId: 'moonbeam',
    chainIdHex: '0x504',
  },
  celo: {
    id: 'celo',
    name: 'Celo',
    symbol: 'CELO',
    icon: '🌿',
    explorerUrl: 'https://celoscan.io',
    dexscreenerId: 'celo',
    geckoTerminalId: 'celo',
    coingeckoId: 'celo',
    chainIdHex: '0xa4ec',
  },
  gnosis: {
    id: 'gnosis',
    name: 'Gnosis',
    symbol: 'xDAI',
    icon: '🦉',
    explorerUrl: 'https://gnosisscan.io',
    dexscreenerId: 'gnosischain',
    geckoTerminalId: 'xdai',
    coingeckoId: 'xdai',
    chainIdHex: '0x64',
  },
};

// ============================================
// TOKEN & PAIR DATA
// ============================================

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
  chain: ChainId;
}

export interface PairInfo {
  address: string;
  chain: ChainId;
  dex: string;
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  priceUsd: number;
  priceNative: number;
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  url: string;
  boosts?: {
    active: number;
  };
}

// ============================================
// MARKET DATA
// ============================================

export interface MarketData {
  priceUsd: number;
  priceNative?: number;
  priceChange24h: number;
  priceChangeH1: number;
  priceChangeM5: number;
  volume24h: number;
  volumeH1: number;
  liquidity: number;
  marketCap?: number;
  fdv?: number;
  txns24h: { buys: number; sells: number };
  txnsH1: { buys: number; sells: number };
  dex: string;
  pairAddress: string;
  pairUrl: string;
  createdAt?: number;
}

// ============================================
// TRENDING & NEW TOKENS
// ============================================

export interface TrendingToken {
  token: TokenInfo;
  pair: PairInfo;
  rank: number;
  score?: number;
  source: 'dexscreener' | 'geckoterminal' | 'birdeye';
}

export interface NewPool {
  pair: PairInfo;
  createdAt: number;
  initialLiquidity: number;
  currentLiquidity: number;
}

// ============================================
// TOKEN SAFETY & ANALYSIS
// ============================================

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface TokenSafetyCheck {
  name: string;
  passed: boolean;
  severity: RiskLevel;
  details: string;
}

export interface TokenSafety {
  overallRisk: RiskLevel;
  riskScore: number; // 0-100, higher = riskier
  checks: TokenSafetyCheck[];
  honeypot: {
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    transferTax: number;
  };
  holders: {
    total: number;
    top10Percentage: number;
    isConcentrated: boolean;
  };
  liquidity: {
    locked: boolean;
    lockDuration?: number;
    lockPercentage?: number;
  };
  contract: {
    verified: boolean;
    renounced: boolean;
    hasProxy: boolean;
    hasMint: boolean;
    hasBlacklist: boolean;
  };
}

// ============================================
// SWAP QUOTES
// ============================================

export interface SwapQuote {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  route: SwapRoute[];
  estimatedGas?: string;
  provider: 'jupiter' | '1inch' | '0x' | 'paraswap';
}

export interface SwapRoute {
  dex: string;
  poolAddress: string;
  inputToken: string;
  outputToken: string;
  fee?: number;
}

// ============================================
// HOLDER DATA
// ============================================

export interface TokenHolder {
  address: string;
  balance: string;
  percentage: number;
  rank: number;
  isContract?: boolean;
  label?: string; // 'DEX', 'CEX', 'Team', etc.
}

export interface HolderAnalysis {
  totalHolders: number;
  top10: TokenHolder[];
  top10Percentage: number;
  distribution: {
    whales: number; // holders with >1%
    dolphins: number; // 0.1% - 1%
    fish: number; // <0.1%
  };
  recentActivity: {
    newHolders24h: number;
    whaleTransfers24h: number;
  };
}

// ============================================
// SOCIAL DATA
// ============================================

export interface SocialInfo {
  twitter?: {
    handle: string;
    followers: number;
    url: string;
  };
  telegram?: {
    handle: string;
    members: number;
    url: string;
  };
  discord?: {
    url: string;
    members?: number;
  };
  website?: string;
  coingecko?: string;
  coinmarketcap?: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// WATCHLIST & ALERTS
// ============================================

export interface WatchlistItem {
  token: TokenInfo;
  addedAt: number;
  entryPrice?: number;
  notes?: string;
  alerts: PriceAlert[];
}

export interface PriceAlert {
  id: string;
  type: 'above' | 'below' | 'change';
  value: number;
  enabled: boolean;
  triggered?: boolean;
  triggeredAt?: number;
}

// ============================================
// WHALE TRACKING
// ============================================

export interface WhaleTransaction {
  hash: string;
  type: 'buy' | 'sell' | 'transfer';
  wallet: string;
  walletLabel?: string;
  token: TokenInfo;
  amount: string;
  amountUsd: number;
  price: number;
  timestamp: number;
  chain: ChainId;
}

export interface TrackedWallet {
  address: string;
  label: string;
  chain: ChainId;
  pnl7d?: number;
  winRate?: number;
  addedAt: number;
}
