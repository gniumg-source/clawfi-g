/**
 * ClawFi Extension - 1inch API Service
 * 
 * Direct integration with 1inch Swap API for EVM chains
 * Provides best swap routes across multiple DEXes
 * 
 * @see https://portal.1inch.dev/documentation
 */

import type { ChainId, TokenInfo, SwapQuote, SwapRoute } from './types';

// 1inch chain IDs
const CHAIN_IDS: Record<ChainId, number | null> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  bsc: 56,
  avalanche: 43114,
  fantom: 250,
  gnosis: 100,
  // Non-EVM chains
  solana: null,
  sui: null,
  aptos: null,
  cronos: 25,
  moonbeam: 1284,
  celo: 42220,
};

const BASE_URL = 'https://api.1inch.dev/swap/v6.0';

// Cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000;

// Note: 1inch API requires API key for production
// Using public endpoints which have lower rate limits

async function fetchWithCache<T>(
  url: string,
  apiKey?: string,
  ttl = CACHE_TTL
): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('1inch rate limit exceeded');
    }
    throw new Error(`1inch API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

// ============================================
// 1INCH API TYPES
// ============================================

interface OneInchToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

interface OneInchQuoteResponse {
  srcToken: OneInchToken;
  dstToken: OneInchToken;
  dstAmount: string;
  protocols: Array<Array<Array<{
    name: string;
    part: number;
    fromTokenAddress: string;
    toTokenAddress: string;
  }>>>;
  gas: number;
}

interface OneInchSwapResponse extends OneInchQuoteResponse {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: number;
  };
}

interface OneInchTokensResponse {
  tokens: Record<string, OneInchToken>;
}

// ============================================
// HELPERS
// ============================================

function getChainId(chain: ChainId): number | null {
  return CHAIN_IDS[chain];
}

function isEvmChain(chain: ChainId): boolean {
  return getChainId(chain) !== null;
}

// ============================================
// API CLASS
// ============================================

export class OneInchAPI {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chain: ChainId): boolean {
    return isEvmChain(chain);
  }

  /**
   * Get supported tokens for a chain
   */
  async getTokens(chain: ChainId): Promise<TokenInfo[]> {
    const chainId = getChainId(chain);
    if (!chainId) return [];

    try {
      const response = await fetchWithCache<OneInchTokensResponse>(
        `${BASE_URL}/${chainId}/tokens`,
        this.apiKey,
        300000 // 5 min cache
      );

      return Object.values(response.tokens).map(token => ({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoUrl: token.logoURI,
        chain,
      }));
    } catch (error) {
      console.error('[1inch] getTokens error:', error);
      return [];
    }
  }

  /**
   * Get swap quote
   */
  async getQuote(
    chain: ChainId,
    fromToken: string,
    toToken: string,
    amount: string,
    slippage = 1 // 1%
  ): Promise<SwapQuote | null> {
    const chainId = getChainId(chain);
    if (!chainId) return null;

    try {
      const params = new URLSearchParams({
        src: fromToken,
        dst: toToken,
        amount,
        includeProtocols: 'true',
      });

      const response = await fetchWithCache<OneInchQuoteResponse>(
        `${BASE_URL}/${chainId}/quote?${params}`,
        this.apiKey,
        15000 // 15 sec cache for quotes
      );

      // Parse routes
      const routes: SwapRoute[] = [];
      for (const routeGroup of response.protocols) {
        for (const route of routeGroup) {
          for (const step of route) {
            routes.push({
              dex: step.name,
              poolAddress: '', // 1inch doesn't provide pool addresses directly
              inputToken: step.fromTokenAddress,
              outputToken: step.toTokenAddress,
            });
          }
        }
      }

      return {
        inputToken: {
          address: response.srcToken.address,
          name: response.srcToken.name,
          symbol: response.srcToken.symbol,
          decimals: response.srcToken.decimals,
          logoUrl: response.srcToken.logoURI,
          chain,
        },
        outputToken: {
          address: response.dstToken.address,
          name: response.dstToken.name,
          symbol: response.dstToken.symbol,
          decimals: response.dstToken.decimals,
          logoUrl: response.dstToken.logoURI,
          chain,
        },
        inputAmount: amount,
        outputAmount: response.dstAmount,
        priceImpact: 0, // 1inch doesn't provide this in quote
        route: routes,
        estimatedGas: response.gas.toString(),
        provider: '1inch',
      };
    } catch (error) {
      console.error('[1inch] getQuote error:', error);
      return null;
    }
  }

  /**
   * Get swap transaction data
   * Note: Requires wallet address
   */
  async getSwap(
    chain: ChainId,
    fromToken: string,
    toToken: string,
    amount: string,
    fromAddress: string,
    slippage = 1
  ): Promise<{
    quote: SwapQuote;
    txData: {
      to: string;
      data: string;
      value: string;
      gasPrice: string;
      gas: number;
    };
  } | null> {
    const chainId = getChainId(chain);
    if (!chainId) return null;

    try {
      const params = new URLSearchParams({
        src: fromToken,
        dst: toToken,
        amount,
        from: fromAddress,
        slippage: slippage.toString(),
        includeProtocols: 'true',
        disableEstimate: 'true', // Skip gas estimation for faster response
      });

      const response = await fetch(
        `${BASE_URL}/${chainId}/swap?${params}`,
        {
          headers: this.apiKey
            ? { 'Authorization': `Bearer ${this.apiKey}`, 'Accept': 'application/json' }
            : { 'Accept': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`Swap failed: ${response.status}`);
      }

      const data: OneInchSwapResponse = await response.json();

      // Parse routes
      const routes: SwapRoute[] = [];
      for (const routeGroup of data.protocols) {
        for (const route of routeGroup) {
          for (const step of route) {
            routes.push({
              dex: step.name,
              poolAddress: '',
              inputToken: step.fromTokenAddress,
              outputToken: step.toTokenAddress,
            });
          }
        }
      }

      return {
        quote: {
          inputToken: {
            address: data.srcToken.address,
            name: data.srcToken.name,
            symbol: data.srcToken.symbol,
            decimals: data.srcToken.decimals,
            logoUrl: data.srcToken.logoURI,
            chain,
          },
          outputToken: {
            address: data.dstToken.address,
            name: data.dstToken.name,
            symbol: data.dstToken.symbol,
            decimals: data.dstToken.decimals,
            logoUrl: data.dstToken.logoURI,
            chain,
          },
          inputAmount: amount,
          outputAmount: data.dstAmount,
          priceImpact: 0,
          route: routes,
          estimatedGas: data.tx.gas.toString(),
          provider: '1inch',
        },
        txData: {
          to: data.tx.to,
          data: data.tx.data,
          value: data.tx.value,
          gasPrice: data.tx.gasPrice,
          gas: data.tx.gas,
        },
      };
    } catch (error) {
      console.error('[1inch] getSwap error:', error);
      return null;
    }
  }

  /**
   * Get token approval status
   */
  async getAllowance(
    chain: ChainId,
    tokenAddress: string,
    walletAddress: string
  ): Promise<string | null> {
    const chainId = getChainId(chain);
    if (!chainId) return null;

    try {
      const response = await fetchWithCache<{ allowance: string }>(
        `${BASE_URL}/${chainId}/approve/allowance?tokenAddress=${tokenAddress}&walletAddress=${walletAddress}`,
        this.apiKey
      );
      return response.allowance;
    } catch (error) {
      console.error('[1inch] getAllowance error:', error);
      return null;
    }
  }

  /**
   * Get approval transaction data
   */
  async getApprovalTx(
    chain: ChainId,
    tokenAddress: string,
    amount?: string // undefined = infinite approval
  ): Promise<{ to: string; data: string; value: string } | null> {
    const chainId = getChainId(chain);
    if (!chainId) return null;

    try {
      const params = new URLSearchParams({ tokenAddress });
      if (amount) params.set('amount', amount);

      const response = await fetchWithCache<{ data: string; gasPrice: string; to: string; value: string }>(
        `${BASE_URL}/${chainId}/approve/transaction?${params}`,
        this.apiKey
      );

      return {
        to: response.to,
        data: response.data,
        value: response.value,
      };
    } catch (error) {
      console.error('[1inch] getApprovalTx error:', error);
      return null;
    }
  }

  /**
   * Get router address for a chain
   */
  async getRouterAddress(chain: ChainId): Promise<string | null> {
    const chainId = getChainId(chain);
    if (!chainId) return null;

    try {
      const response = await fetchWithCache<{ address: string }>(
        `${BASE_URL}/${chainId}/approve/spender`,
        this.apiKey,
        3600000 // 1 hour cache
      );
      return response.address;
    } catch (error) {
      console.error('[1inch] getRouterAddress error:', error);
      return null;
    }
  }

  /**
   * Build swap URL for 1inch app
   */
  buildSwapUrl(chain: ChainId, fromToken: string, toToken: string): string {
    const chainId = getChainId(chain);
    if (!chainId) return 'https://app.1inch.io/';
    
    return `https://app.1inch.io/#/${chainId}/simple/swap/${fromToken}/${toToken}`;
  }

  /**
   * Get liquidity sources for a chain
   */
  async getLiquiditySources(chain: ChainId): Promise<string[]> {
    const chainId = getChainId(chain);
    if (!chainId) return [];

    try {
      const response = await fetchWithCache<{ protocols: Array<{ id: string; title: string }> }>(
        `${BASE_URL}/${chainId}/liquidity-sources`,
        this.apiKey,
        3600000
      );
      return response.protocols.map(p => p.id);
    } catch (error) {
      console.error('[1inch] getLiquiditySources error:', error);
      return [];
    }
  }
}

// Export singleton (without API key - can be set later)
export const oneInchAPI = new OneInchAPI();
