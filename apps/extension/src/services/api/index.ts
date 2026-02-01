/**
 * ClawFi Extension - API Services Index
 * 
 * Unified exports for all DeFi data sources
 */

// Types
export * from './types';

// API Services
export { dexscreenerAPI, DexscreenerAPI } from './dexscreener';
export { geckoTerminalAPI, GeckoTerminalAPI } from './geckoterminal';
export { jupiterAPI, JupiterAPI, SOLANA_TOKENS } from './jupiter';
export { oneInchAPI, OneInchAPI } from './oneinch';
export { tokenSafetyChecker, TokenSafetyChecker } from './safety';
export { whaleTracker, WhaleTracker } from './whales';

// ============================================
// UNIFIED DATA SERVICE
// ============================================

import type { ChainId, TokenInfo, MarketData, TrendingToken, NewPool, SwapQuote, TokenSafety } from './types';
import { dexscreenerAPI } from './dexscreener';
import { geckoTerminalAPI } from './geckoterminal';
import { jupiterAPI } from './jupiter';
import { oneInchAPI } from './oneinch';
import { tokenSafetyChecker } from './safety';

/**
 * Unified data service that combines all APIs
 */
export class UnifiedDataService {
  /**
   * Get comprehensive market data for a token
   * Combines data from multiple sources
   */
  async getMarketData(tokenAddress: string, chain: ChainId): Promise<MarketData | null> {
    // Try Dexscreener first (most comprehensive)
    const dexData = await dexscreenerAPI.getTokenMarketData(tokenAddress, chain);
    if (dexData) return dexData;
    
    // Fallback to GeckoTerminal
    const pools = await geckoTerminalAPI.getTokenPools(chain, tokenAddress);
    if (pools.length > 0) {
      const bestPool = pools.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
      return {
        priceUsd: bestPool.priceUsd,
        priceChange24h: bestPool.priceChange.h24,
        priceChangeH1: bestPool.priceChange.h1,
        priceChangeM5: bestPool.priceChange.m5,
        volume24h: bestPool.volume.h24,
        volumeH1: bestPool.volume.h1,
        liquidity: bestPool.liquidity.usd,
        marketCap: bestPool.marketCap,
        fdv: bestPool.fdv,
        txns24h: bestPool.txns.h24,
        txnsH1: bestPool.txns.h1,
        dex: bestPool.dex,
        pairAddress: bestPool.address,
        pairUrl: bestPool.url,
        createdAt: bestPool.pairCreatedAt,
      };
    }
    
    // For Solana, try Jupiter
    if (chain === 'solana') {
      return await jupiterAPI.getTokenMarketData(tokenAddress);
    }
    
    return null;
  }

  /**
   * Get trending tokens across all chains or specific chain
   */
  async getTrending(chain?: ChainId): Promise<TrendingToken[]> {
    const results: TrendingToken[] = [];
    
    try {
      if (chain) {
        // Get from GeckoTerminal for specific chain
        const geckoTrending = await geckoTerminalAPI.getTrendingPoolsByNetwork(chain);
        results.push(...geckoTrending);
      } else {
        // Get boosted from Dexscreener
        const boosted = await dexscreenerAPI.getBoostedTokens();
        results.push(...boosted);
        
        // Get global trending from GeckoTerminal
        const geckoTrending = await geckoTerminalAPI.getTrendingPools();
        results.push(...geckoTrending);
      }
    } catch (error) {
      console.error('[UnifiedData] getTrending error:', error);
    }
    
    // Deduplicate by token address
    const seen = new Set<string>();
    return results.filter(t => {
      const key = `${t.token.chain}:${t.token.address}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get newly created pools
   */
  async getNewPools(chain: ChainId): Promise<NewPool[]> {
    return geckoTerminalAPI.getNewPools(chain);
  }

  /**
   * Search for tokens/pairs
   */
  async search(query: string, chain?: ChainId): Promise<TokenInfo[]> {
    const results: TokenInfo[] = [];
    
    // Search Dexscreener
    const dexPairs = await dexscreenerAPI.searchPairs(query);
    for (const pair of dexPairs) {
      if (!chain || pair.chain === chain) {
        results.push(pair.baseToken);
      }
    }
    
    // If Solana, also search Jupiter
    if (!chain || chain === 'solana') {
      const jupTokens = await jupiterAPI.searchTokens(query);
      results.push(...jupTokens);
    }
    
    // Deduplicate
    const seen = new Set<string>();
    return results.filter(t => {
      const key = `${t.chain}:${t.address}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get swap quote
   */
  async getSwapQuote(
    chain: ChainId,
    inputToken: string,
    outputToken: string,
    amount: string,
    slippage?: number
  ): Promise<SwapQuote | null> {
    if (chain === 'solana') {
      return jupiterAPI.getQuote(inputToken, outputToken, amount, slippage ? slippage * 100 : 50);
    } else {
      return oneInchAPI.getQuote(chain, inputToken, outputToken, amount, slippage || 1);
    }
  }

  /**
   * Get token safety analysis
   */
  async getTokenSafety(tokenAddress: string, chain: ChainId): Promise<TokenSafety> {
    return tokenSafetyChecker.analyze(chain, tokenAddress);
  }

  /**
   * Get quick risk score (0-100)
   */
  async getRiskScore(tokenAddress: string, chain: ChainId): Promise<number> {
    return tokenSafetyChecker.getQuickRiskScore(chain, tokenAddress);
  }

  /**
   * Build swap URL for external DEX
   */
  getSwapUrl(chain: ChainId, inputToken: string, outputToken: string): string {
    if (chain === 'solana') {
      return jupiterAPI.buildSwapUrl(inputToken, outputToken);
    } else {
      return oneInchAPI.buildSwapUrl(chain, inputToken, outputToken);
    }
  }

  /**
   * Get DEX-specific swap URL
   */
  getDexSwapUrl(chain: ChainId, tokenAddress: string): {
    uniswap?: string;
    pancakeswap?: string;
    jupiter?: string;
    raydium?: string;
  } {
    const urls: ReturnType<typeof this.getDexSwapUrl> = {};
    
    switch (chain) {
      case 'ethereum':
        urls.uniswap = `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${tokenAddress}`;
        break;
      case 'base':
        urls.uniswap = `https://app.uniswap.org/swap?chain=base&outputCurrency=${tokenAddress}`;
        break;
      case 'arbitrum':
        urls.uniswap = `https://app.uniswap.org/swap?chain=arbitrum&outputCurrency=${tokenAddress}`;
        break;
      case 'bsc':
        urls.pancakeswap = `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${tokenAddress}`;
        break;
      case 'solana':
        urls.jupiter = `https://jup.ag/swap/SOL-${tokenAddress}`;
        urls.raydium = `https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${tokenAddress}`;
        break;
    }
    
    return urls;
  }

  /**
   * Get explorer URL for a token
   */
  getExplorerUrl(chain: ChainId, tokenAddress: string): string {
    const explorers: Record<string, string> = {
      ethereum: 'https://etherscan.io/token/',
      base: 'https://basescan.org/token/',
      arbitrum: 'https://arbiscan.io/token/',
      optimism: 'https://optimistic.etherscan.io/token/',
      polygon: 'https://polygonscan.com/token/',
      bsc: 'https://bscscan.com/token/',
      avalanche: 'https://snowtrace.io/token/',
      solana: 'https://solscan.io/token/',
      fantom: 'https://ftmscan.com/token/',
    };
    
    const baseUrl = explorers[chain] || explorers.ethereum;
    return `${baseUrl}${tokenAddress}`;
  }

  /**
   * Get Dexscreener URL for a token
   */
  getDexscreenerUrl(chain: ChainId, tokenAddress: string): string {
    return `https://dexscreener.com/${chain}/${tokenAddress}`;
  }

  /**
   * Get GeckoTerminal URL for a token
   */
  getGeckoTerminalUrl(chain: ChainId, tokenAddress: string): string {
    const geckoNetworks: Record<string, string> = {
      ethereum: 'eth',
      base: 'base',
      arbitrum: 'arbitrum',
      bsc: 'bsc',
      solana: 'solana',
      polygon: 'polygon_pos',
    };
    
    const network = geckoNetworks[chain] || chain;
    return `https://www.geckoterminal.com/${network}/tokens/${tokenAddress}`;
  }
}

// Export singleton
export const unifiedDataService = new UnifiedDataService();

// Default export
export default unifiedDataService;
