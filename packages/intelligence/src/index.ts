/**
 * ClawF Intelligence Module
 * 
 * Provider-agnostic inference engine for generating explanations.
 * Supports multiple backends without exposing vendor-specific details.
 * 
 * IMPORTANT: This module must remain vendor-neutral.
 * - No references to specific AI providers
 * - All provider selection happens through configuration
 * - Explanations are evidence-based and deterministic
 */

export * from './types.js';
export * from './providers/index.js';
export * from './engine.js';
