/**
 * CLI Configuration Store
 * Persists settings and auth tokens
 */

import Conf from 'conf';

interface ConfigSchema {
  host: string;
  token: string;
  user: string;
  lastLogin: number;
}

export const config = new Conf<ConfigSchema>({
  projectName: 'clawfi-cli',
  defaults: {
    host: '',
    token: '',
    user: '',
    lastLogin: 0,
  },
});

/**
 * Default API host
 */
export const DEFAULT_HOST = 'http://localhost:3001';

/**
 * Get configured host or default
 */
export function getHost(): string {
  return config.get('host') || DEFAULT_HOST;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return Boolean(config.get('token'));
}

/**
 * Get auth token
 */
export function getToken(): string | undefined {
  return config.get('token') || undefined;
}

/**
 * Save auth credentials
 */
export function saveAuth(host: string, token: string, user: string): void {
  config.set('host', host);
  config.set('token', token);
  config.set('user', user);
  config.set('lastLogin', Date.now());
}

/**
 * Clear auth credentials
 */
export function clearAuth(): void {
  config.set('token', '');
  config.set('user', '');
  config.set('lastLogin', 0);
}
