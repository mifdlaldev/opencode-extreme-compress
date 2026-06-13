import type { PluginConfig, ModelProfile } from './types';

export function getDefaultConfig(): PluginConfig {
  const modelProfiles: Record<string, ModelProfile> = {
    '*': { mode: 'light', maxContextUsage: 0.95 },
    'deepseek-v4-flash-free': { mode: 'medium', maxContextUsage: 0.80 },
    'minimax-m3': { mode: 'light', maxContextUsage: 0.95 },
    'minimax-m2.7': { mode: 'light', maxContextUsage: 0.90 },
    'kimi-k2.6': { mode: 'light', maxContextUsage: 0.90 },
    'mimo-v2.5-free': { mode: 'medium', maxContextUsage: 0.85 },
  };

  return {
    mode: 'light',
    modelProfiles,
    outputBudget: {
      enabled: true,
      trackRemaining: true,
      triggerIfLow: 0.20,
    },
    propagateToSubagents: {
      enabled: true,
      mode: 'inherit',
      excludeSubagents: [],
    },
    tokenizer: {
      strategy: 'auto',
      modelTokenizers: {
        'minimax-m3': 'chars4',
        'kimi-k2.6': 'chars4',
        'deepseek-v4-flash-free': 'chars4',
      },
    },
    antiHallucination: {
      enabled: true,
      mustPreserve: [
        '**/AGENTS.md',
        '**/DESIGN.md',
        '**/package.json',
        '**/tsconfig.json',
        '**/*.lock',
      ],
      verifyPaths: true,
      verifyIdentifiers: true,
      failSafe: 'no-compression',
    },
    layers: {
      toolOutput: {
        enabled: true,
        headLines: 200,
        tailLines: 50,
        maxBytes: 102400,
        preservePatterns: [
          '(?i)(error|fail|exception|warning)',
          '\\b\\w+\\.ts:\\d+:',
          '\\b[A-Z][a-zA-Z]+Error\\b',
        ],
      },
      fileContent: {
        enabled: false,
        excludeGlobs: ['*.md', '*.json', '*.yaml', '*.lock', '**/AGENTS.md', '**/DESIGN.md'],
      },
      semantic: {
        enabled: false,
        model: 'kimi-k2.6',
        variant: 'low',
        trigger: { minMessages: 15, keepRecent: 4 },
        maxSummaryTokens: 1500,
      },
    },
    excludeGlobs: ['**/AGENTS.md', '**/DESIGN.md', '**/*.lock'],
  };
}

export async function loadConfig(path?: string): Promise<PluginConfig> {
  if (!path) {
    return getDefaultConfig();
  }

  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) {
    return getDefaultConfig();
  }

  try {
    const content = await file.text();
    // Strip JSONC comments
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const parsed = JSON.parse(stripped);
    return mergeWithDefaults(parsed);
  } catch (error) {
    // Fail-safe: return defaults on parse error
    return getDefaultConfig();
  }
}

function mergeWithDefaults(userConfig: Partial<PluginConfig>): PluginConfig {
  const defaults = getDefaultConfig();
  return {
    mode: userConfig.mode ?? defaults.mode,
    modelProfiles: { ...defaults.modelProfiles, ...userConfig.modelProfiles },
    outputBudget: { ...defaults.outputBudget, ...userConfig.outputBudget },
    propagateToSubagents: { ...defaults.propagateToSubagents, ...userConfig.propagateToSubagents },
    tokenizer: { ...defaults.tokenizer, ...userConfig.tokenizer },
    antiHallucination: { ...defaults.antiHallucination, ...userConfig.antiHallucination },
    layers: {
      toolOutput: { ...defaults.layers.toolOutput, ...userConfig.layers?.toolOutput },
      fileContent: { ...defaults.layers.fileContent, ...userConfig.layers?.fileContent },
      semantic: { ...defaults.layers.semantic, ...userConfig.layers?.semantic },
    },
    excludeGlobs: userConfig.excludeGlobs ?? defaults.excludeGlobs,
  };
}

export function resolveProfile(config: PluginConfig, modelId: string): ModelProfile {
  // Exact match first
  if (config.modelProfiles[modelId]) {
    return config.modelProfiles[modelId];
  }
  // Fallback to '*'
  return config.modelProfiles['*'] ?? { mode: 'light', maxContextUsage: 0.95 };
}
