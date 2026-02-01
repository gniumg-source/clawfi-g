/**
 * ClawFi Extension - Jupiter API Service
 * 
 * Direct integration with Jupiter (Solana) APIs
 * - Price API: Token prices
 * - Quote API: Swap quotes
 * - Token List API: Verified tokens
 * 
 * Rate limits: ~60-600 req/min (varies by endpoint)
 * 
 * @see https://station.jup.ag/docs/apis
 */

import type { TokenInfo, SwapQuote, SwapRoute, MarketData } from './types';

const PRICE_API = 'https://api.jup.ag/price/v2';
const QUOTE_API = 'https://api.jup.ag/swap/v1';
const TOKEN_API = 'https://tokens.jup.ag';

// Cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds for prices

async function fetchWithCache<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Jupiter API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

// ============================================
// JUPITER API TYPES
// ============================================

interface JupiterPriceData {
  id: string;
  type: string;
  price: string;
  extraInfo?: {
    lastSwappedPrice?: {
      lastJupiterSellAt: number;
      lastJupiterSellPrice: string;
      lastJupiterBuyAt: number;
      lastJupiterBuyPrice: string;
    };
    quotedPrice?: {
      buyPrice: string;
      buyAt: number;
      sellPrice: string;
      sellAt: number;
    };
    confidenceLevel?: string;
    depth?: {
      buyPriceImpactRatio: { depth: Record<string, number> };
      sellPriceImpactRatio: { depth: Record<string, number> };
    };
  };
}

interface JupiterPriceResponse {
  data: Record<string, JupiterPriceData>;
  timeTaken: number;
}

interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
  extensions?: {
    coingeckoId?: string;
  };
}

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

// ============================================
// HELPER CONSTANTS
// ============================================

// Common Solana tokens
export const SOLANA_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

// ============================================
// API CLASS
// ============================================

export class JupiterAPI {
  /**
   * Get token price in USD
   */
  async getPrice(tokenMint: string): Promise<number | null> {
    try {
      const response = await fetchWithCache<JupiterPriceResponse>(
        `${PRICE_API}?ids=${tokenMint}`
      );
      
      const priceData = response.data[tokenMint];
      return priceData ? parseFloat(priceData.price) : null;
    } catch (error) {
      console.error('[Jupiter] getPrice error:', error);
      return null;
    }
  }

  /**
   * Get multiple token prices
   */
  async getPrices(tokenMints: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    try {
      // Batch into groups of 100
      const batches: string[][] = [];
      for (let i = 0; i < tokenMints.length; i += 100) {
        batches.push(tokenMints.slice(i, i + 100));
      }
      
      for (const batch of batches) {
        const response = await fetchWithCache<JupiterPriceResponse>(
          `${PRICE_API}?ids=${batch.join(',')}`
        );
        
        for (const [mint, data] of Object.entries(response.data)) {
          if (data && data.price) {
            prices.set(mint, parseFloat(data.price));
          }
        }
      }
    } catch (error) {
      console.error('[Jupiter] getPrices error:', error);
    }
    
    return prices;
  }

  /**
   * Get price with extra info (depth, confidence)
   */
  async getPriceWithDetails(tokenMint: string): Promise<{
    price: number;
    confidence: string;
    buyPrice?: number;
    sellPrice?: number;
    depthBuy?: Record<string, number>;
    depthSell?: Record<string, number>;
  } | null> {
    try {
      const response = await fetchWithCache<JupiterPriceResponse>(
        `${PRICE_API}?ids=${tokenMint}&showExtraInfo=true`
      );
      
      const priceData = response.data[tokenMint];
      if (!priceData) return null;
      
      return {
        price: parseFloat(priceData.price),
        confidence: priceData.extraInfo?.confidenceLevel || 'unknown',
        buyPrice: priceData.extraInfo?.quotedPrice?.buyPrice 
          ? parseFloat(priceData.extraInfo.quotedPrice.buyPrice) 
          : undefined,
        sellPrice: priceData.extraInfo?.quotedPrice?.sellPrice 
          ? parseFloat(priceData.extraInfo.quotedPrice.sellPrice) 
          : undefined,
        depthBuy: priceData.extraInfo?.depth?.buyPriceImpactRatio?.depth,
        depthSell: priceData.extraInfo?.depth?.sellPriceImpactRatio?.depth,
      };
    } catch (error) {
      console.error('[Jupiter] getPriceWithDetails error:', error);
      return null;
    }
  }

  /**
   * Get swap quote
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps = 50 // 0.5%
  ): Promise<SwapQuote | null> {
    try {
      const response = await fetch(
        `${QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
      );
      
      if (!response.ok) {
        throw new Error(`Quote failed: ${response.status}`);
      }
      
      const quote: JupiterQuoteResponse = await response.json();
      
      // Get token info for input/output
      const [inputToken, outputToken] = await Promise.all([
        this.getTokenInfo(inputMint),
        this.getTokenInfo(outputMint),
      ]);
      
      const routes: SwapRoute[] = quote.routePlan.map(route => ({
        dex: route.swapInfo.label,
        poolAddress: route.swapInfo.ammKey,
        inputToken: route.swapInfo.inputMint,
        outputToken: route.swapInfo.outputMint,
      }));
      
      return {
        inputToken: inputToken || {
          address: inputMint,
          name: 'Unknown',
          symbol: 'UNK',
          decimals: 9,
          chain: 'solana',
        },
        outputToken: outputToken || {
          address: outputMint,
          name: 'Unknown',
          symbol: 'UNK',
          decimals: 9,
          chain: 'solana',
        },
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: parseFloat(quote.priceImpactPct),
        route: routes,
        provider: 'jupiter',
      };
    } catch (error) {
      console.error('[Jupiter] getQuote error:', error);
      return null;
    }
  }

  /**
   * Get verified token list
   */
  async getVerifiedTokens(): Promise<JupiterToken[]> {
    try {
      const response = await fetchWithCache<JupiterToken[]>(
        `${TOKEN_API}/tokens?tags=verified`,
        300000 // 5 min cache
      );
      return response;
    } catch (error) {
      console.error('[Jupiter] getVerifiedTokens error:', error);
      return [];
    }
  }

  /**
   * Get all tokens (strict list)
   */
  async getStrictTokens(): Promise<JupiterToken[]> {
    try {
      const response = await fetchWithCache<JupiterToken[]>(
        `${TOKEN_API}/tokens_with_markets`,
        300000
      );
      return response;
    } catch (error) {
      console.error('[Jupiter] getStrictTokens error:', error);
      return [];
    }
  }

  /**
   * Get token info by mint
   */
  async getTokenInfo(mint: string): Promise<TokenInfo | null> {
    try {
      // Check verified tokens first
      const verifiedTokens = await this.getVerifiedTokens();
      const token = verifiedTokens.find(t => t.address === mint);
      
      if (token) {
        return {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          logoUrl: token.logoURI,
          chain: 'solana',
        };
      }
      
      // Fallback: try to get from all tokens
      const allTokens = await this.getStrictTokens();
      const allToken = allTokens.find(t => t.address === mint);
      
      if (allToken) {
        return {
          address: allToken.address,
          name: allToken.name,
          symbol: allToken.symbol,
          decimals: allToken.decimals,
          logoUrl: allToken.logoURI,
          chain: 'solana',
        };
      }
      
      return null;
    } catch (error) {
      console.error('[Jupiter] getTokenInfo error:', error);
      return null;
    }
  }

  /**
   * Search tokens
   */
  async searchTokens(query: string): Promise<TokenInfo[]> {
    try {
      const tokens = await this.getVerifiedTokens();
      const queryLower = query.toLowerCase();
      
      return tokens
        .filter(t => 
          t.name.toLowerCase().includes(queryLower) ||
          t.symbol.toLowerCase().includes(queryLower) ||
          t.address.toLowerCase() === queryLower
        )
        .slice(0, 20)
        .map(t => ({
          address: t.address,
          name: t.name,
          symbol: t.symbol,
          decimals: t.decimals,
          logoUrl: t.logoURI,
          chain: 'solana' as const,
        }));
    } catch (error) {
      console.error('[Jupiter] searchTokens error:', error);
      return [];
    }
  }

  /**
   * Check if token is verified
   */
  async isVerified(mint: string): Promise<boolean> {
    try {
      const tokens = await this.getVerifiedTokens();
      return tokens.some(t => t.address === mint);
    } catch {
      return false;
    }
  }

  /**
   * Get token market data (price + basic info)
   */
  async getTokenMarketData(mint: string): Promise<MarketData | null> {
    try {
      const [priceData, tokenInfo] = await Promise.all([
        this.getPriceWithDetails(mint),
        this.getTokenInfo(mint),
      ]);
      
      if (!priceData) return null;
      
      return {
        priceUsd: priceData.price,
        priceChange24h: 0, // Jupiter doesn't provide this
        priceChangeH1: 0,
        priceChangeM5: 0,
        volume24h: 0,
        volumeH1: 0,
        liquidity: 0, // Would need to aggregate from pools
        dex: 'Jupiter',
        pairAddress: mint,
        pairUrl: `https://jup.ag/swap/SOL-${mint}`,
        txns24h: { buys: 0, sells: 0 },
        txnsH1: { buys: 0, sells: 0 },
      };
    } catch (error) {
      console.error('[Jupiter] getTokenMarketData error:', error);
      return null;
    }
  }

  /**
   * Build swap URL
   */
  buildSwapUrl(inputMint: string, outputMint: string): string {
    return `https://jup.ag/swap/${inputMint}-${outputMint}`;
  }

  /**
   * Get price impact for a trade
   */
  async getPriceImpact(
    inputMint: string,
    outputMint: string,
    amountInLamports: string
  ): Promise<number | null> {
    const quote = await this.getQuote(inputMint, outputMint, amountInLamports);
    return quote?.priceImpact ?? null;
  }
}

// Export singleton
export const jupiterAPI = new JupiterAPI();
