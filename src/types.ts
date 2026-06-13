// Type definitions for extreme-compress plugin

export type CompressionMode = 'off' | 'shadow' | 'light' | 'medium' | 'extreme';

export interface ModelProfile {
  mode: CompressionMode;
  maxContextUsage: number;  // 0.0 - 1.0
}

export interface ModelProfiles {
  [modelId: string]: ModelProfile;
}

export interface ToolOutputConfig {
  enabled: boolean;
  headLines: number;
  tailLines: number;
  maxBytes: number;
  preservePatterns: string[];
}

export interface FileContentConfig {
  enabled: boolean;
  excludeGlobs: string[];
}

export interface SemanticConfig {
  enabled: boolean;
  model: string;
  variant?: string;
  trigger: {
    minMessages: number;
    keepRecent: number;
  };
  maxSummaryTokens: number;
}

export interface LayersConfig {
  toolOutput: ToolOutputConfig;
  fileContent: FileContentConfig;
  semantic: SemanticConfig;
}

export interface AntiHallucinationConfig {
  enabled: boolean;
  mustPreserve: string[];
  verifyPaths: boolean;
  verifyIdentifiers: boolean;
  failSafe: 'no-compression';
}

export interface OutputBudgetConfig {
  enabled: boolean;
  trackRemaining: boolean;
  triggerIfLow: number;
}

export interface SubagentPropagationConfig {
  enabled: boolean;
  mode: 'inherit' | 'force-off' | 'force-light' | 'force-medium';
  excludeSubagents: string[];
}

export interface TokenizerConfig {
  strategy: 'auto' | 'chars4' | 'tiktoken' | 'model-specific';
  modelTokenizers: Record<string, string>;
}

export interface PluginConfig {
  mode: CompressionMode;
  modelProfiles: ModelProfiles;
  outputBudget: OutputBudgetConfig;
  propagateToSubagents: SubagentPropagationConfig;
  tokenizer: TokenizerConfig;
  antiHallucination: AntiHallucinationConfig;
  layers: LayersConfig;
  excludes: string[];
}

export interface CompressionResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  ratio: number;  // 0.0 - 1.0, fraction reduced
  method: 'none' | 'truncate' | 'strip' | 'summarize';
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
