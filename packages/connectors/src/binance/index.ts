/**
 * Binance Connector
 * 
 * Security Notes:
 * - API keys are stored encrypted in database
 * - Withdrawal endpoints are NOT implemented (by design)
 * - All trading is gated by the risk engine
 * - Dry-run mode available for testing
 * 
 * Supported Operations:
 * - GET account balances
 * - GET open orders
 * - POST place order (market/limit)
 * - DELETE cancel order
 */

import axios, { type AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import { z } from 'zod';
import type { Vault } from '@clawfi/vault';
import type {
  ICexConnector,
  ConnectorHealth,
  Balance,
  Order,
  OrderRequest,
} from '../types.js';

/**
 * Binance connector configuration
 */
export const BinanceConfigSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  testnet: z.boolean().default(true), // Default to testnet for safety
  // API credentials are stored encrypted, not in config
});
export type BinanceConfig = z.infer<typeof BinanceConfigSchema>;

/**
 * Encrypted Binance credentials
 */
export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Binance API URLs
 */
const BINANCE_URLS = {
  mainnet: 'https://api.binance.com',
  testnet: 'https://testnet.binance.vision',
} as const;

/**
 * Binance connector implementation
 */
export class BinanceConnector implements ICexConnector {
  readonly id: string;
  readonly type = 'cex' as const;
  readonly venue = 'binance' as const;

  private client: AxiosInstance;
  private apiKey: string = '';
  private apiSecret: string = '';
  private readonly testnet: boolean;
  private initialized = false;

  constructor(
    private readonly config: BinanceConfig,
    private readonly vault: Vault,
    private readonly getEncryptedCredentials: () => Promise<{
      apiKey: { ciphertext: string; iv: string; tag: string; salt: string; version: number };
      apiSecret: { ciphertext: string; iv: string; tag: string; salt: string; version: number };
    } | null>
  ) {
    this.id = config.id;
    this.testnet = config.testnet;
    
    const baseURL = this.testnet ? BINANCE_URLS.testnet : BINANCE_URLS.mainnet;
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize the connector by loading credentials
   */
  async initialize(): Promise<void> {
    const encrypted = await this.getEncryptedCredentials();
    
    if (!encrypted) {
      throw new Error('Binance credentials not found');
    }

    const context = `connector:binance:${this.id}`;
    
    this.apiKey = this.vault.decrypt(encrypted.apiKey, `${context}:api_key`);
    this.apiSecret = this.vault.decrypt(encrypted.apiSecret, `${context}:api_secret`);
    
    this.client.defaults.headers.common['X-MBX-APIKEY'] = this.apiKey;
    this.initialized = true;
  }

  /**
   * Check if connector is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Connector not initialized. Call initialize() first.');
    }
  }

  /**
   * Sign a request with HMAC SHA256
   */
  private signRequest(params: Record<string, string | number>): string {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    const signature = createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
    
    return `${queryString}&signature=${signature}`;
  }

  /**
   * Get current timestamp
   */
  private getTimestamp(): number {
    return Date.now();
  }

  /**
   * Make a signed GET request
   */
  private async signedGet<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    this.ensureInitialized();
    
    const timestamp = this.getTimestamp();
    const signedParams = this.signRequest({ ...params, timestamp });
    
    const response = await this.client.get(`${endpoint}?${signedParams}`);
    return response.data;
  }

  /**
   * Make a signed POST request
   */
  private async signedPost<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    this.ensureInitialized();
    
    const timestamp = this.getTimestamp();
    const signedParams = this.signRequest({ ...params, timestamp });
    
    const response = await this.client.post(`${endpoint}?${signedParams}`);
    return response.data;
  }

  /**
   * Make a signed DELETE request
   */
  private async signedDelete<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    this.ensureInitialized();
    
    const timestamp = this.getTimestamp();
    const signedParams = this.signRequest({ ...params, timestamp });
    
    const response = await this.client.delete(`${endpoint}?${signedParams}`);
    return response.data;
  }

  /**
   * Get connector health status
   */
  async getHealth(): Promise<ConnectorHealth> {
    try {
      const start = Date.now();
      await this.client.get('/api/v3/ping');
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
   * Get account balances
   */
  async getBalances(): Promise<Balance[]> {
    interface BinanceBalance {
      asset: string;
      free: string;
      locked: string;
    }
    
    interface BinanceAccount {
      balances: BinanceBalance[];
    }
    
    const account = await this.signedGet<BinanceAccount>('/api/v3/account');
    
    return account.balances
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: (parseFloat(b.free) + parseFloat(b.locked)).toString(),
      }));
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    interface BinanceOrder {
      orderId: number;
      symbol: string;
      side: string;
      type: string;
      status: string;
      price: string;
      origQty: string;
      executedQty: string;
      time: number;
      updateTime: number;
    }
    
    const params: Record<string, string> = {};
    if (symbol) {
      params.symbol = symbol;
    }
    
    const orders = await this.signedGet<BinanceOrder[]>('/api/v3/openOrders', params);
    
    return orders.map((o) => ({
      id: o.orderId.toString(),
      externalId: o.orderId.toString(),
      venue: 'binance',
      symbol: o.symbol,
      side: o.side.toLowerCase() as 'buy' | 'sell',
      type: o.type.toLowerCase() as 'market' | 'limit',
      status: this.mapOrderStatus(o.status),
      price: o.price,
      quantity: o.origQty,
      filledQuantity: o.executedQty,
      createdAt: o.time,
      updatedAt: o.updateTime,
    }));
  }

  /**
   * Map Binance order status to internal status
   */
  private mapOrderStatus(status: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      NEW: 'open',
      PARTIALLY_FILLED: 'partially_filled',
      FILLED: 'filled',
      CANCELED: 'cancelled',
      REJECTED: 'rejected',
      EXPIRED: 'expired',
    };
    return statusMap[status] ?? 'pending';
  }

  /**
   * Place an order
   * 
   * IMPORTANT: This operation is gated by the risk engine.
   * The connector itself does not enforce risk limits.
   */
  async placeOrder(request: OrderRequest): Promise<Order> {
    const params: Record<string, string | number> = {
      symbol: request.symbol,
      side: request.side.toUpperCase(),
      type: request.type.toUpperCase(),
      quantity: request.quantity,
    };
    
    if (request.type === 'limit' && request.price) {
      params.price = request.price;
      params.timeInForce = request.timeInForce ?? 'GTC';
    }
    
    interface BinanceOrderResponse {
      orderId: number;
      symbol: string;
      side: string;
      type: string;
      status: string;
      price: string;
      origQty: string;
      executedQty: string;
      transactTime: number;
    }
    
    const response = await this.signedPost<BinanceOrderResponse>('/api/v3/order', params);
    
    return {
      id: response.orderId.toString(),
      externalId: response.orderId.toString(),
      venue: 'binance',
      symbol: response.symbol,
      side: response.side.toLowerCase() as 'buy' | 'sell',
      type: response.type.toLowerCase() as 'market' | 'limit',
      status: this.mapOrderStatus(response.status),
      price: response.price,
      quantity: response.origQty,
      filledQuantity: response.executedQty,
      createdAt: response.transactTime,
      updatedAt: response.transactTime,
    };
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol: string): Promise<boolean> {
    try {
      await this.signedDelete('/api/v3/order', {
        symbol,
        orderId: parseInt(orderId, 10),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown the connector
   */
  async shutdown(): Promise<void> {
    // Clear sensitive data
    this.apiKey = '';
    this.apiSecret = '';
    this.initialized = false;
  }
}

/**
 * Create a Binance connector instance
 */
export function createBinanceConnector(
  config: BinanceConfig,
  vault: Vault,
  getEncryptedCredentials: () => Promise<{
    apiKey: { ciphertext: string; iv: string; tag: string; salt: string; version: number };
    apiSecret: { ciphertext: string; iv: string; tag: string; salt: string; version: number };
  } | null>
): BinanceConnector {
  return new BinanceConnector(config, vault, getEncryptedCredentials);
}


