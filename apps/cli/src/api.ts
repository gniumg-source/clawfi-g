/**
 * API Client for CLI
 */

import { getHost, getToken } from './config.js';
import chalk from 'chalk';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make API request
 */
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { host?: string; token?: string }
): Promise<ApiResponse<T>> {
  const host = options?.host || getHost();
  const token = options?.token || getToken();
  
  const url = `${host}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json() as ApiResponse<T>;

    if (!response.ok || !data.success) {
      throw new ApiError(
        data.error?.message ?? 'Request failed',
        data.error?.code ?? 'UNKNOWN_ERROR',
        response.status
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof Error) {
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        throw new ApiError(
          `Cannot connect to ${host}. Is the ClawFi node running?`,
          'CONNECTION_ERROR',
          0
        );
      }
      throw new ApiError(err.message, 'NETWORK_ERROR', 0);
    }
    throw err;
  }
}

/**
 * Login to API
 */
export async function login(
  email: string,
  password: string,
  host: string
): Promise<{ token: string; user: { email: string; name?: string } }> {
  const response = await request<{ token: string; user: { email: string; name?: string } }>(
    'POST',
    '/auth/login',
    { email, password },
    { host }
  );
  return response.data!;
}

/**
 * Get agent status
 */
export async function getAgentStatus(): Promise<{
  version: string;
  uptimeFormatted: string;
  killSwitchActive: boolean;
  dryRunMode: boolean;
  connectors: { total: number; connected: number };
  strategies: { total: number; enabled: number };
  signalsToday: number;
  watchedTokens: number;
  watchedWallets: number;
}> {
  const response = await request<any>('GET', '/agent/status');
  return response.data;
}

/**
 * Execute agent command
 */
export async function executeCommand(command: string): Promise<{
  success: boolean;
  action: string;
  message: string;
  data?: Record<string, unknown>;
}> {
  const response = await request<any>('POST', '/agent/command', { command });
  return response.data;
}

/**
 * Get signals
 */
export async function getSignals(options: {
  limit?: number;
  severity?: string;
  chain?: string;
  acknowledged?: boolean;
}): Promise<{ signals: any[]; pagination: any }> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.severity) params.set('severity', options.severity);
  if (options.chain) params.set('chain', options.chain);
  if (options.acknowledged !== undefined) params.set('acknowledged', String(options.acknowledged));
  
  const query = params.toString();
  const response = await request<any>('GET', `/signals${query ? `?${query}` : ''}`);
  return { signals: response.data, pagination: response.pagination };
}

/**
 * Get strategies
 */
export async function getStrategies(): Promise<any[]> {
  const response = await request<any>('GET', '/strategies');
  return response.data;
}

/**
 * Update strategy
 */
export async function updateStrategy(id: string, status: 'enabled' | 'disabled'): Promise<any> {
  const response = await request<any>('PATCH', `/strategies/${id}`, { status });
  return response.data;
}

/**
 * Get connections
 */
export async function getConnections(): Promise<any[]> {
  const response = await request<any>('GET', '/connections');
  return response.data;
}

/**
 * Set kill switch
 */
export async function setKillSwitch(active: boolean): Promise<{ active: boolean }> {
  const response = await request<{ active: boolean }>('POST', '/risk/killswitch', { active });
  return response.data!;
}
