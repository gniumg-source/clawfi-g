import { z } from 'zod';
import { TimestampSchema, UuidSchema } from '../common/index.js';

/**
 * Audit log action types
 */
export const AuditActionSchema = z.enum([
  // Auth
  'user_login',
  'user_logout',
  'user_register',
  
  // Connectors
  'connector_added',
  'connector_updated',
  'connector_removed',
  'connector_test',
  'connector_started',
  'connector_stopped',
  
  // Trading
  'order_requested',
  'order_placed',
  'order_rejected',
  'order_cancelled',
  'order_filled',
  
  // Risk
  'risk_policy_updated',
  'risk_check_passed',
  'risk_check_failed',
  'kill_switch_enabled',
  'kill_switch_disabled',
  
  // Strategies
  'strategy_enabled',
  'strategy_disabled',
  'strategy_config_updated',
  'strategy_error',
  
  // Signals
  'signal_created',
  'signal_acknowledged',
  
  // System
  'system_start',
  'system_stop',
  'system_error',
  
  // Agent
  'agent_command',
  
  // Dev/Test
  'launch_simulated',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

/**
 * Audit log entry
 */
export const AuditLogSchema = z.object({
  id: UuidSchema,
  ts: TimestampSchema,
  action: AuditActionSchema,
  userId: UuidSchema.optional(),
  
  // Context
  resource: z.string().optional(), // e.g., 'connector:binance', 'strategy:moltwatch'
  resourceId: z.string().optional(),
  
  // Details (sanitized - never contains secrets)
  details: z.record(z.unknown()).optional(),
  
  // Result
  success: z.boolean(),
  errorMessage: z.string().optional(),
  
  // Request context
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

/**
 * Audit log creation input
 */
export const CreateAuditLogSchema = AuditLogSchema.omit({ id: true, ts: true });
export type CreateAuditLog = z.infer<typeof CreateAuditLogSchema>;

/**
 * Audit log filter
 */
export const AuditLogFilterSchema = z.object({
  action: AuditActionSchema.optional(),
  userId: UuidSchema.optional(),
  resource: z.string().optional(),
  success: z.boolean().optional(),
  startTs: TimestampSchema.optional(),
  endTs: TimestampSchema.optional(),
});
export type AuditLogFilter = z.infer<typeof AuditLogFilterSchema>;

/**
 * Sensitive fields that should be redacted in logs
 */
export const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'apiKey',
  'apiSecret',
  'privateKey',
  'mnemonic',
  'seed',
  'token',
  'accessToken',
  'refreshToken',
] as const;

/**
 * Redact sensitive information from an object
 */
export function redactSensitive<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = { ...obj };
  
  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = redactSensitive(result[key] as Record<string, unknown>);
    }
  }
  
  return result as T;
}

