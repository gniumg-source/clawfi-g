/**
 * Remote Inference Provider
 * 
 * Calls an external inference endpoint for generating explanations.
 * Provider-agnostic - works with any compatible HTTP endpoint.
 * 
 * The endpoint should accept POST requests with JSON body and return
 * a response in the expected Explanation format.
 */

import {
  InferenceProvider,
  InferenceConfig,
  ExplanationContext,
  Explanation,
} from '../types.js';

export class RemoteProvider implements InferenceProvider {
  readonly name = 'remote';
  
  constructor(private config: InferenceConfig) {
    if (!config.endpoint) {
      throw new Error('Remote provider requires endpoint configuration');
    }
  }
  
  async isAvailable(): Promise<boolean> {
    if (!this.config.endpoint) {
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(this.config.endpoint, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok || response.status === 405; // 405 = method not allowed but endpoint exists
    } catch {
      return false;
    }
  }
  
  async generateExplanation(context: ExplanationContext): Promise<Explanation> {
    if (!this.config.endpoint) {
      throw new Error('Endpoint not configured');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      // Add API key if configured (provider-agnostic header)
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
      
      // Build the prompt for the inference provider
      const prompt = this.buildPrompt(context);
      
      const body = {
        prompt,
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        context: {
          metrics: context.metrics,
          signals: context.signals?.map(s => s.signal),
          score: context.score,
        },
      };
      
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Inference request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Parse and validate response
      return this.parseResponse(result);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Inference request timed out');
      }
      
      throw error;
    }
  }
  
  private buildPrompt(context: ExplanationContext): string {
    const { metrics, signals, conditions, score, flags } = context;
    
    const parts: string[] = [
      'Analyze this token and provide an objective assessment.',
      '',
      `Token: ${metrics.symbol} on ${metrics.chain}`,
      `Price: $${metrics.priceUsd}`,
      `1h Change: ${metrics.priceChange1h}%`,
      `24h Change: ${metrics.priceChange24h}%`,
      `Volume 24h: $${metrics.volume24h.toLocaleString()}`,
      `Liquidity: $${metrics.liquidity.toLocaleString()}`,
      `Market Cap: $${metrics.fdv.toLocaleString()}`,
      `Buys: ${metrics.buys24h} | Sells: ${metrics.sells24h}`,
    ];
    
    if (score !== undefined) {
      parts.push(`Composite Score: ${score}/100`);
    }
    
    if (signals && signals.length > 0) {
      parts.push('', 'Signals:', ...signals.map(s => `- ${s.signal}`));
    }
    
    if (conditions && conditions.length > 0) {
      const passed = conditions.filter(c => c.passed);
      parts.push('', 'Conditions Met:', ...passed.map(c => `- ${c.name}: ${c.evidence || c.value}`));
    }
    
    if (flags && flags.length > 0) {
      parts.push('', 'Risk Flags:', ...flags.map(f => `- [${f.severity.toUpperCase()}] ${f.message}`));
    }
    
    parts.push(
      '',
      'Provide:',
      '1. Brief summary (1-2 sentences)',
      '2. Detailed rationale based on metrics',
      '3. List of risks',
      '4. Suggested actions (informational only)',
      '',
      'Format response as JSON with: summary, rationale, risks[], suggestedActions[]',
      'Base all statements on the provided metrics. Never claim certainty about future price.',
    );
    
    return parts.join('\n');
  }
  
  private parseResponse(result: unknown): Explanation {
    // Handle various response formats
    let parsed: Record<string, unknown>;
    
    if (typeof result === 'string') {
      // Try to parse as JSON
      try {
        parsed = JSON.parse(result);
      } catch {
        // If not JSON, treat as raw text response
        return {
          summary: result.substring(0, 200),
          rationale: result,
          risks: ['Unable to parse structured response'],
          suggestedActions: ['Review raw response for details'],
          confidence: 0.5,
          provider: 'remote',
          generatedAt: new Date().toISOString(),
        };
      }
    } else if (typeof result === 'object' && result !== null) {
      parsed = result as Record<string, unknown>;
    } else {
      throw new Error('Invalid response format');
    }
    
    // Extract fields with fallbacks
    // Handle nested response formats (some providers wrap in 'choices' or 'content')
    const content = this.extractContent(parsed);
    
    return {
      summary: this.extractString(content, 'summary', 'No summary available'),
      rationale: this.extractString(content, 'rationale', 'No rationale provided'),
      risks: this.extractArray(content, 'risks', ['Unknown risks']),
      suggestedActions: this.extractArray(content, 'suggestedActions', ['DYOR']),
      confidence: this.extractNumber(content, 'confidence', 0.7),
      provider: 'remote',
      generatedAt: new Date().toISOString(),
    };
  }
  
  private extractContent(parsed: Record<string, unknown>): Record<string, unknown> {
    // Handle common wrapper formats
    if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices[0]) {
      const choice = parsed.choices[0] as Record<string, unknown>;
      if (choice.message && typeof choice.message === 'object') {
        const message = choice.message as Record<string, unknown>;
        if (typeof message.content === 'string') {
          try {
            return JSON.parse(message.content);
          } catch {
            return { summary: message.content };
          }
        }
      }
    }
    
    if (parsed.content && typeof parsed.content === 'object') {
      return parsed.content as Record<string, unknown>;
    }
    
    if (parsed.result && typeof parsed.result === 'object') {
      return parsed.result as Record<string, unknown>;
    }
    
    return parsed;
  }
  
  private extractString(obj: Record<string, unknown>, key: string, fallback: string): string {
    const value = obj[key];
    return typeof value === 'string' ? value : fallback;
  }
  
  private extractArray(obj: Record<string, unknown>, key: string, fallback: string[]): string[] {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    return fallback;
  }
  
  private extractNumber(obj: Record<string, unknown>, key: string, fallback: number): number {
    const value = obj[key];
    return typeof value === 'number' ? value : fallback;
  }
}
