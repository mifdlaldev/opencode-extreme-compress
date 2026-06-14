// Type definitions for extreme-compress plugin

export type CompressionMode = 'off' | 'shadow' | 'light' | 'medium' | 'extreme';

export interface ModelProfile {
  maxContextUsage: number;  // 0.0 - 1.0, fraction of model context that can be used before compression triggers
}

export interface ModelProfiles {
  // Map of modelId (or '*' for default) → profile
  // Example: { '*': {...}, 'minimax-m3': {...}, 'deepseek-v4-flash-free': {...} }
  [modelId: string]: ModelProfile;
}

export interface ToolOutputConfig {
  enabled: boolean;
  headLines: number;           // Keep first N lines of output
  tailLines: number;           // Keep last N lines of output
  maxBytes: number;            // Hard cap on output size in bytes
  preservePatterns: string[];  // Regex patterns for lines that must never be truncated
}

export interface FileContentConfig {
  enabled: boolean;
  excludeGlobs: string[];  // Glob patterns for files to skip (e.g., AGENTS.md)
}

export interface SemanticConfig {
  enabled: boolean;
  model: string;                       // LLM model to use for summarization (e.g., 'kimi-k2.6')
  variant?: string;                    // Model variant (e.g., 'low', 'high', 'max')
  trigger: {
    minMessages: number;               // Summarize after this many messages
    keepRecent: number;                // Never summarize the last N messages
  };
  maxSummaryTokens: number;            // Cap on summary length
}

export interface LayersConfig {
  toolOutput: ToolOutputConfig;    // Layer 1
  fileContent: FileContentConfig;  // Layer 2
  semantic: SemanticConfig;        // Layer 3
}

export interface AntiHallucinationConfig {
  enabled: boolean;
  mustPreserve: string[];      // Glob patterns for files that must never be compressed
  verifyPaths: boolean;        // Layer 3 verification: check file paths preserved
  verifyIdentifiers: boolean;  // Layer 3 verification: check identifiers preserved
  failSafe: 'no-compression';  // On uncertainty, skip compression entirely
}

export interface OutputBudgetConfig {
  enabled: boolean;
  trackRemaining: boolean;  // Monitor remaining output budget per turn
  triggerIfLow: number;     // 0.0-1.0, trigger compression when remaining budget below this
}

export interface SubagentPropagationConfig {
  enabled: boolean;
  mode: 'inherit' | 'force-off' | 'force-light' | 'force-medium';
  excludeSubagents: string[];  // Subagent names that should never compress
}

export interface TokenizerConfig {
  strategy: 'auto' | 'chars4' | 'tiktoken' | 'model-specific';
  modelTokenizers: Record<string, string>;  // Map modelId → tokenizer strategy
}

export interface StatsConfig {
  enabled: boolean;
  path: string;
  rotateMonthly: boolean;
}

export interface PluginConfig {
  mode: CompressionMode;
  modelProfiles: ModelProfiles;
  outputBudget: OutputBudgetConfig;
  propagateToSubagents: SubagentPropagationConfig;
  tokenizer: TokenizerConfig;
  antiHallucination: AntiHallucinationConfig;
  layers: LayersConfig;
  excludeGlobs: string[];  // Top-level file patterns to exclude from ALL compression
  stats: StatsConfig;
}

export interface CompressionResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  /**
   * Reduction ratio: fraction of original tokens REMOVED.
   * - 0.0 = no reduction (compressed same size as original)
   * - 0.5 = 50% reduction (compressed is half the size)
   * - 1.0 = 100% reduction (compressed is empty)
   * Example: originalTokens=1000, compressedTokens=250 → ratio=0.75 (75% reduction)
   */
  ratio: number;
  method: 'none' | 'truncate' | 'strip' | 'summarize';
  /**
   * Human-readable marker indicating compression was applied.
   * Format: [EXTREME-COMPRESS L{n}: {before}→{after} tokens ({pct}% saved)]
   */
  marker?: string;
}

export interface VerificationResult {
  passed: boolean;
  missingPaths: string[];
  missingIdentifiers: string[];
  missingErrorCodes: string[];
  retried: boolean;
  fellBack: boolean;
}
