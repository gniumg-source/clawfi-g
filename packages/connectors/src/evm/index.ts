/**
 * EVM DEX Connector
 * 
 * Provides DEX quoting and transaction building for EVM chains.
 * 
 * v1 Scope:
 * - Quote via Uniswap v2/v3 style routers
 * - Read token metadata (decimals, symbol)
 * - NO auto-trade - just quoting and assist mode
 * 
 * Future:
 * - Transaction building with user wallet signature
 * - Multiple DEX aggregation
 */

import { z } from 'zod';
import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  type PublicClient,
  type Address,
} from 'viem';
import { mainnet, arbitrum, base, polygon, optimism } from 'viem/chains';
import type { Chain } from '@clawfi/core';
import type { IDexConnector, ConnectorHealth, QuoteRequest, QuoteResponse } from '../types.js';

/**
 * Supported chains and their viem chain configs
 */
const CHAIN_CONFIGS = {
  ethereum: mainnet,
  arbitrum: arbitrum,
  base: base,
  polygon: polygon,
  optimism: optimism,
} as const;

/**
 * Default RPC URLs (users should provide their own for production)
 */
const DEFAULT_RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com',
  optimism: 'https://mainnet.optimism.io',
};

/**
 * EVM DEX connector configuration
 */
export const EvmDexConfigSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  chains: z.array(z.string()).default(['ethereum']),
  rpcUrls: z.record(z.string()).optional(),
});
export type EvmDexConfig = z.infer<typeof EvmDexConfigSchema>;

/**
 * ERC20 ABI fragment for basic operations
 */
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

/**
 * Uniswap V2 Router ABI fragment
 */
const UNISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Known Uniswap V2 style router addresses
 */
const UNISWAP_V2_ROUTERS: Record<string, Address> = {
  ethereum: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  arbitrum: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
  base: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
};

/**
 * WETH addresses by chain
 */
const WETH_ADDRESSES: Record<string, Address> = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  base: '0x4200000000000000000000000000000000000006',
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  optimism: '0x4200000000000000000000000000000000000006',
};

/**
 * Token metadata cache
 */
interface TokenMetadata {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * EVM DEX Connector implementation
 */
export class EvmDexConnector implements IDexConnector {
  readonly id: string;
  readonly type = 'dex' as const;
  readonly venue = 'uniswap_v2' as const;

  private clients: Map<string, PublicClient> = new Map();
  private tokenCache: Map<string, TokenMetadata> = new Map();
  private readonly config: EvmDexConfig;

  constructor(config: EvmDexConfig) {
    this.id = config.id;
    this.config = config;
  }

  /**
   * Initialize the connector
   */
  async initialize(): Promise<void> {
    for (const chainName of this.config.chains) {
      const chainConfig = CHAIN_CONFIGS[chainName as keyof typeof CHAIN_CONFIGS];
      if (!chainConfig) {
        continue;
      }

      const rpcUrl = this.config.rpcUrls?.[chainName] ?? DEFAULT_RPC_URLS[chainName];
      if (!rpcUrl) {
        continue;
      }

      const client = createPublicClient({
        chain: chainConfig,
        transport: http(rpcUrl),
      }) as PublicClient;

      this.clients.set(chainName, client);
    }
  }

  /**
   * Get client for a chain
   */
  private getClient(chain: string): PublicClient {
    const client = this.clients.get(chain);
    if (!client) {
      throw new Error(`No client configured for chain: ${chain}`);
    }
    return client;
  }

  /**
   * Get connector health status
   */
  async getHealth(): Promise<ConnectorHealth> {
    try {
      const start = Date.now();
      
      // Test first available chain
      const [chainName, client] = this.clients.entries().next().value ?? [];
      if (!client) {
        return {
          status: 'error',
          lastCheck: Date.now(),
          error: 'No chains configured',
        };
      }

      await client.getBlockNumber();
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
   * Get token metadata
   */
  async getTokenMetadata(chain: string, address: Address): Promise<TokenMetadata> {
    const cacheKey = `${chain}:${address.toLowerCase()}`;
    
    const cached = this.tokenCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = this.getClient(chain);

    const [decimals, symbol, name] = await Promise.all([
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'name',
      }).catch(() => 'Unknown'),
    ]);

    const metadata: TokenMetadata = {
      address,
      symbol: symbol as string,
      name: name as string,
      decimals: decimals as number,
    };

    this.tokenCache.set(cacheKey, metadata);
    return metadata;
  }

  /**
   * Get a swap quote using Uniswap V2 style router
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const chain = request.chain;
    const client = this.getClient(chain);
    
    const routerAddress = UNISWAP_V2_ROUTERS[chain];
    if (!routerAddress) {
      throw new Error(`No Uniswap V2 router configured for chain: ${chain}`);
    }

    const tokenInAddress = request.tokenIn as Address;
    const tokenOutAddress = request.tokenOut as Address;

    // Get token metadata for decimals
    const [tokenInMeta, tokenOutMeta] = await Promise.all([
      this.getTokenMetadata(chain, tokenInAddress),
      this.getTokenMetadata(chain, tokenOutAddress),
    ]);

    const amountInWei = parseUnits(request.amountIn, tokenInMeta.decimals);

    // Build path - simple direct swap or through WETH
    const weth = WETH_ADDRESSES[chain];
    let path: Address[];
    
    if (
      tokenInAddress.toLowerCase() === weth?.toLowerCase() ||
      tokenOutAddress.toLowerCase() === weth?.toLowerCase()
    ) {
      // Direct swap if one token is WETH
      path = [tokenInAddress, tokenOutAddress];
    } else {
      // Route through WETH
      path = weth ? [tokenInAddress, weth, tokenOutAddress] : [tokenInAddress, tokenOutAddress];
    }

    try {
      const amounts = await client.readContract({
        address: routerAddress,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, path],
      });

      const amountOutWei = amounts[amounts.length - 1];
      const amountOut = formatUnits(amountOutWei ?? BigInt(0), tokenOutMeta.decimals);

      // Calculate price impact (simplified)
      // In production, would compare to market price
      const priceImpactBps = 0; // Placeholder

      return {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn: request.amountIn,
        amountOut,
        priceImpactBps,
        route: path,
      };
    } catch (error) {
      throw new Error(
        `Failed to get quote: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(chain: string, tokenAddress: Address, walletAddress: Address): Promise<string> {
    const client = this.getClient(chain);
    const metadata = await this.getTokenMetadata(chain, tokenAddress);

    const balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    return formatUnits(balance as bigint, metadata.decimals);
  }

  /**
   * Shutdown the connector
   */
  async shutdown(): Promise<void> {
    this.clients.clear();
    this.tokenCache.clear();
  }
}

/**
 * Create an EVM DEX connector instance
 */
export function createEvmDexConnector(config: EvmDexConfig): EvmDexConnector {
  return new EvmDexConnector(config);
}

export { type TokenMetadata };

