/**
 * Jupiter DEX Connector for Solana
 * 
 * Jupiter is the leading DEX aggregator on Solana, routing trades across
 * multiple DEXs (Raydium, Orca, Serum, etc.) for best execution.
 * 
 * Features:
 * - Get swap quotes from Jupiter API
 * - Token metadata lookup
 * - Price information
 * - Route optimization
 * 
 * API Docs: https://station.jup.ag/docs/apis/swap-api
 */

import { z } from 'zod';
import axios, { type AxiosInstance } from 'axios';
import type { IDexConnector, ConnectorHealth, QuoteRequest, QuoteResponse } from '../types.js';

/**
 * Jupiter API base URL
 */
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_URL = 'https://price.jup.ag/v6';
const JUPITER_TOKEN_URL = 'https://token.jup.ag';

/**
 * Jupiter connector configuration
 */
export const JupiterConfigSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  defaultSlippageBps: z.number().default(50), // 0.5% default
  excludeDexes: z.array(z.string()).optional(),
  onlyDirectRoutes: z.boolean().default(false),
});
export type JupiterConfig = z.infer<typeof JupiterConfigSchema>;

/**
 * Jupiter quote response from API
 */
interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: {
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
  }[];
  contextSlot?: number;
  timeTaken?: number;
}

/**
 * Jupiter token info
 */
interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Jupiter price response
 */
interface JupiterPriceResponse {
  data: Record<string, {
    id: string;
    mintSymbol: string;
    vsToken: string;
    vsTokenSymbol: string;
    price: number;
  }>;
  timeTaken: number;
}

/**
 * Token cache entry
 */
interface TokenCacheEntry {
  token: JupiterToken;
  timestamp: number;
}

/**
 * Jupiter DEX Connector implementation
 */
export class JupiterConnector implements IDexConnector {
  readonly id: string;
  readonly type = 'dex' as const;
  readonly venue = 'jupiter' as const;

  private client: AxiosInstance;
  private priceClient: AxiosInstance;
  private tokenClient: AxiosInstance;
  private tokenCache: Map<string, TokenCacheEntry> = new Map();
  private allTokens: JupiterToken[] = [];
  private tokensLoaded = false;
  private readonly config: JupiterConfig;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: JupiterConfig) {
    this.id = config.id;
    this.config = config;

    this.client = axios.create({
      baseURL: JUPITER_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.priceClient = axios.create({
      baseURL: JUPITER_PRICE_URL,
      timeout: 10000,
    });

    this.tokenClient = axios.create({
      baseURL: JUPITER_TOKEN_URL,
      timeout: 30000,
    });
  }

  /**
   * Initialize the connector - load token list
   */
  async initialize(): Promise<void> {
    try {
      // Load verified token list
      const response = await this.tokenClient.get<JupiterToken[]>('/strict');
      this.allTokens = response.data;
      
      // Cache tokens by address
      for (const token of this.allTokens) {
        this.tokenCache.set(token.address, {
          token,
          timestamp: Date.now(),
        });
      }
      
      this.tokensLoaded = true;
    } catch (error) {
      console.warn('Failed to load Jupiter token list:', error);
      // Continue without pre-loaded tokens - will fetch on demand
    }
  }

  /**
   * Get connector health status
   */
  async getHealth(): Promise<ConnectorHealth> {
    try {
      const start = Date.now();
      
      // Test API by getting SOL price
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      await this.priceClient.get(`/price?ids=${SOL_MINT}`);
      
      const latencyMs = Date.now() - start;

      return {
        status: 'connected',
        lastCheck: Date.now(),
        latencyMs,
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get token information by mint address
   */
  async getToken(mintAddress: string): Promise<JupiterToken | null> {
    // Check cache first
    const cached = this.tokenCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.token;
    }

    // Try to find in pre-loaded list
    const found = this.allTokens.find(t => t.address === mintAddress);
    if (found) {
      this.tokenCache.set(mintAddress, { token: found, timestamp: Date.now() });
      return found;
    }

    // Fetch from API
    try {
      const response = await this.tokenClient.get<JupiterToken>(`/token/${mintAddress}`);
      const token = response.data;
      this.tokenCache.set(mintAddress, { token, timestamp: Date.now() });
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Get token price in USD
   */
  async getTokenPrice(mintAddress: string): Promise<number | null> {
    try {
      const response = await this.priceClient.get<JupiterPriceResponse>(`/price?ids=${mintAddress}`);
      return response.data.data[mintAddress]?.price ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get multiple token prices
   */
  async getTokenPrices(mintAddresses: string[]): Promise<Record<string, number>> {
    try {
      const ids = mintAddresses.join(',');
      const response = await this.priceClient.get<JupiterPriceResponse>(`/price?ids=${ids}`);
      
      const prices: Record<string, number> = {};
      for (const [mint, data] of Object.entries(response.data.data)) {
        prices[mint] = data.price;
      }
      return prices;
    } catch {
      return {};
    }
  }

  /**
   * Search tokens by symbol or name
   */
  async searchTokens(query: string, limit = 20): Promise<JupiterToken[]> {
    if (!this.tokensLoaded) {
      await this.initialize();
    }

    const queryLower = query.toLowerCase();
    return this.allTokens
      .filter(t => 
        t.symbol.toLowerCase().includes(queryLower) ||
        t.name.toLowerCase().includes(queryLower) ||
        t.address.toLowerCase() === queryLower
      )
      .slice(0, limit);
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const slippageBps = request.slippageBps ?? this.config.defaultSlippageBps;

    // Get token info for proper decimal handling
    const [inputToken, outputToken] = await Promise.all([
      this.getToken(request.tokenIn),
      this.getToken(request.tokenOut),
    ]);

    if (!inputToken) {
      throw new Error(`Unknown input token: ${request.tokenIn}`);
    }
    if (!outputToken) {
      throw new Error(`Unknown output token: ${request.tokenOut}`);
    }

    // Convert amount to lamports/smallest unit
    const amountInLamports = Math.floor(
      parseFloat(request.amountIn) * Math.pow(10, inputToken.decimals)
    ).toString();

    try {
      const params: Record<string, string | number | boolean> = {
        inputMint: request.tokenIn,
        outputMint: request.tokenOut,
        amount: amountInLamports,
        slippageBps,
      };

      if (this.config.onlyDirectRoutes) {
        params.onlyDirectRoutes = true;
      }

      if (this.config.excludeDexes?.length) {
        params.excludeDexes = this.config.excludeDexes.join(',');
      }

      const response = await this.client.get<JupiterQuoteResponse>('/quote', { params });
      const quote = response.data;

      // Convert output amount from lamports
      const amountOut = (
        parseFloat(quote.outAmount) / Math.pow(10, outputToken.decimals)
      ).toString();

      // Parse price impact
      const priceImpactBps = Math.round(parseFloat(quote.priceImpactPct) * 100);

      // Build route description
      const route = quote.routePlan.map(r => r.swapInfo.label);

      return {
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        amountOut,
        priceImpactBps,
        route,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error || error.message;
        throw new Error(`Jupiter quote failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Get swap transaction data (for signing by user wallet)
   */
  async buildSwapTx(request: QuoteRequest): Promise<{
    swapTransaction: string;
    lastValidBlockHeight: number;
  }> {
    // First get quote
    const slippageBps = request.slippageBps ?? this.config.defaultSlippageBps;
    
    const inputToken = await this.getToken(request.tokenIn);
    if (!inputToken) {
      throw new Error(`Unknown input token: ${request.tokenIn}`);
    }

    const amountInLamports = Math.floor(
      parseFloat(request.amountIn) * Math.pow(10, inputToken.decimals)
    ).toString();

    // Get quote first
    const quoteResponse = await this.client.get<JupiterQuoteResponse>('/quote', {
      params: {
        inputMint: request.tokenIn,
        outputMint: request.tokenOut,
        amount: amountInLamports,
        slippageBps,
        onlyDirectRoutes: this.config.onlyDirectRoutes,
      },
    });

    // Then get swap transaction
    // Note: This requires a user public key - would be passed in real implementation
    throw new Error('Swap transaction building requires user wallet public key');
  }

  /**
   * Get popular/trending tokens
   */
  async getTrendingTokens(limit = 20): Promise<JupiterToken[]> {
    if (!this.tokensLoaded) {
      await this.initialize();
    }

    // Return tokens that are likely popular (have tags like 'verified', 'community')
    return this.allTokens
      .filter(t => t.tags?.includes('verified') || t.tags?.includes('community'))
      .slice(0, limit);
  }

  /**
   * Common token mints
   */
  static readonly TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  } as const;

  /**
   * Shutdown the connector
   */
  async shutdown(): Promise<void> {
    this.tokenCache.clear();
    this.allTokens = [];
    this.tokensLoaded = false;
  }
}

/**
 * Create a Jupiter connector instance
 */
export function createJupiterConnector(config: JupiterConfig): JupiterConnector {
  return new JupiterConnector(config);
}

export { type JupiterToken, type JupiterQuoteResponse };
