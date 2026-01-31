/**
 * Telegram Webhook Notifier
 * 
 * Sends concise notifications to Telegram for important signals.
 * 
 * Required ENV:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_CHAT_ID: Target chat/channel ID
 */

import type { Signal } from '@clawfi/core';

// ============================================
// Types
// ============================================

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled?: boolean;
  signalTypes?: string[];
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

// ============================================
// Constants
// ============================================

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};

const SIGNAL_TYPE_EMOJI: Record<string, string> = {
  LaunchDetected: '🚀',
  MoltDetected: '🦀',
  EarlyDistribution: '⚠️',
  LiquidityRisk: '🔥',
  RiskAlert: '⚠️',
  PriceAlert: '📈',
};

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

// ============================================
// Telegram Notifier
// ============================================

export class TelegramNotifier {
  private readonly config: Required<TelegramConfig>;
  private lastSendTime = 0;
  private readonly minIntervalMs = 1000; // Rate limit: 1 msg/sec

  constructor(config: TelegramConfig) {
    this.config = {
      enabled: true,
      signalTypes: ['LaunchDetected', 'MoltDetected', 'EarlyDistribution', 'LiquidityRisk'],
      minSeverity: 'medium',
      ...config,
    };
  }

  /**
   * Check if notifier is configured and enabled
   */
  isEnabled(): boolean {
    return (
      this.config.enabled &&
      !!this.config.botToken &&
      !!this.config.chatId
    );
  }

  /**
   * Check if signal should be notified
   */
  shouldNotify(signal: Signal): boolean {
    if (!this.isEnabled()) return false;

    // Check signal type
    if (
      signal.signalType &&
      !this.config.signalTypes.includes(signal.signalType)
    ) {
      return false;
    }

    // Check severity
    const signalSeverityIndex = SEVERITY_ORDER.indexOf(signal.severity);
    const minSeverityIndex = SEVERITY_ORDER.indexOf(this.config.minSeverity);
    
    if (signalSeverityIndex < minSeverityIndex) {
      return false;
    }

    return true;
  }

  /**
   * Send notification for a signal
   */
  async notify(signal: Signal): Promise<boolean> {
    if (!this.shouldNotify(signal)) {
      return false;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;
    if (timeSinceLastSend < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - timeSinceLastSend));
    }

    const message = this.formatMessage(signal);
    const success = await this.sendMessage(message);
    
    if (success) {
      this.lastSendTime = Date.now();
    }

    return success;
  }

  /**
   * Format signal into Telegram message
   */
  private formatMessage(signal: Signal): string {
    const severityEmoji = SEVERITY_EMOJI[signal.severity] || '⚪';
    const typeEmoji = signal.signalType 
      ? (SIGNAL_TYPE_EMOJI[signal.signalType] || '📢')
      : '📢';

    const lines: string[] = [];

    // Header
    lines.push(`${typeEmoji} *${this.escapeMarkdown(signal.title)}*`);
    lines.push('');

    // Summary
    lines.push(`${severityEmoji} ${this.escapeMarkdown(signal.summary)}`);
    lines.push('');

    // Token info
    if (signal.token) {
      const shortAddr = `${signal.token.slice(0, 6)}...${signal.token.slice(-4)}`;
      const basescanUrl = `https://basescan.org/token/${signal.token}`;
      lines.push(`🪙 Token: [${signal.tokenSymbol || shortAddr}](${basescanUrl})`);
    }

    // Chain
    if (signal.chain) {
      lines.push(`⛓️ Chain: ${signal.chain.toUpperCase()}`);
    }

    // Evidence links
    if (signal.evidence) {
      const evidence = signal.evidence as Record<string, unknown>;
      
      if (evidence.txHash) {
        const txUrl = `https://basescan.org/tx/${evidence.txHash}`;
        lines.push(`📜 [View Transaction](${txUrl})`);
      }

      if (evidence.creatorAddress) {
        const creatorUrl = `https://basescan.org/address/${evidence.creatorAddress}`;
        const shortAddr = `${String(evidence.creatorAddress).slice(0, 6)}...${String(evidence.creatorAddress).slice(-4)}`;
        lines.push(`👤 Creator: [${shortAddr}](${creatorUrl})`);
      }

      if (evidence.wallet) {
        const walletUrl = `https://basescan.org/address/${evidence.wallet}`;
        const shortAddr = `${String(evidence.wallet).slice(0, 6)}...${String(evidence.wallet).slice(-4)}`;
        lines.push(`👛 Wallet: [${shortAddr}](${walletUrl})`);
      }

      if (evidence.fromToken && evidence.toToken) {
        lines.push(`🔄 ${String(evidence.fromToken).slice(0, 10)} → ${String(evidence.toToken).slice(0, 10)}`);
      }
    }

    // Footer
    lines.push('');
    lines.push(`_ClawFi • ${new Date().toISOString().slice(0, 16)}_`);

    return lines.join('\n');
  }

  /**
   * Escape Markdown special characters
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Send message via Telegram Bot API
   */
  private async sendMessage(text: string): Promise<boolean> {
    try {
      const url = `${TELEGRAM_API_BASE}${this.config.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json() as TelegramResponse;

      if (!data.ok) {
        console.error('[Telegram] Send failed:', data.description);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Telegram] Send error:', error);
      return false;
    }
  }

  /**
   * Test connection by sending a test message
   */
  async testConnection(): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const success = await this.sendMessage(
        '🦀 *ClawFi Connected*\n\nTelegram notifications are now active\\.'
      );
      return success;
    } catch {
      return false;
    }
  }
}

/**
 * Create Telegram notifier from environment
 */
export function createTelegramNotifier(): TelegramNotifier {
  return new TelegramNotifier({
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
  });
}

