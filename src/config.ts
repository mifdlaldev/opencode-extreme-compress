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

  // Restrict to project root / cwd to prevent path traversal
  const safePath = sanitizePath(path);
  if (!safePath) {
    return getDefaultConfig();
  }

  const file = Bun.file(safePath);
  const exists = await file.exists();
  if (!exists) {
    return getDefaultConfig();
  }

  try {
    const content = await file.text();
    const stripped = stripJsoncComments(content);
    const parsed = JSON.parse(stripped);
    return mergeWithDefaults(parsed);
  } catch (error) {
    // Fail-safe: return defaults on parse error
    return getDefaultConfig();
  }
}

function sanitizePath(path: string): string | null {
  // Reject path traversal attempts
  if (path.includes('..')) return null;
  // Only allow absolute paths within home or relative paths in cwd
  if (path.startsWith('~')) {
    return path.replace('~', process.env.HOME ?? '');
  }
  if (path.startsWith('/')) {
    return path;
  }
  // Relative path: pass through (Bun.file resolves against cwd)
  return path;
}

/**
 * Strip JSONC comments (// and /* *​/) while respecting string boundaries.
 * This is a proper state-machine parser, not a regex hack — it will not
 * corrupt URLs or other content that happens to contain // or /* *​/.
 */
export function stripJsoncComments(input: string): string {
  let result = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // String literal (double or single quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      result += ch;
      i++;
      while (i < len) {
        const c = input[i];
        if (c === '\\' && i + 1 < len) {
          // Escape sequence: keep both chars
          result += c + input[i + 1];
          i += 2;
          continue;
        }
        if (c === quote) {
          result += c;
          i++;
          break;
        }
        result += c;
        i++;
      }
      continue;
    }

    // Line comment
    if (ch === '/' && input[i + 1] === '/') {
      // Skip until end of line (keep the newline)
      while (i < len && input[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < len) {
        if (input[i] === '*' && input[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    // Regular char
    result += ch;
    i++;
  }

  return result;
}

/**
 * Check if a value is a plain object (not array, not null).
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

/**
 * Deep merge two objects. Source values override target values.
 * - Nested plain objects are recursively merged.
 * - Arrays are replaced (not concatenated) — user must specify full array.
 * - undefined values in source are skipped (target preserved).
 * - null values in source ARE applied (user can null out a default).
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!source) return { ...target };

  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (sourceVal === undefined) continue;

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

function mergeWithDefaults(userConfig: Partial<PluginConfig> | undefined): PluginConfig {
  const defaults = getDefaultConfig();
  if (!userConfig) return defaults;

  // deepMerge operates on Record<string, unknown>; widen/narrow at the boundary
  const merged = deepMerge(
    defaults as unknown as Record<string, unknown>,
    userConfig as unknown as Record<string, unknown>
  );
  return merged as unknown as PluginConfig;
}

export function resolveProfile(config: PluginConfig, modelId: string): ModelProfile {
  // Exact match first
  if (config.modelProfiles[modelId]) {
    return config.modelProfiles[modelId];
  }
  // Fallback to '*'
  return config.modelProfiles['*'] ?? { mode: 'light', maxContextUsage: 0.95 };
}
