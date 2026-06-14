import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Pricing } from './types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.config', 'opencode', 'extreme-compress.jsonc');

/**
 * Strip JSONC (JSON with Comments) syntax to make a string parseable by JSON.parse.
 * Supports // line comments, /* block comments *​/, with proper string-escape handling.
 * Trailing commas are NOT auto-stripped here — write valid JSON or use a real JSONC parser.
 */
function stripJsonc(input: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < input.length) {
    const c = input[i];
    if (inString) {
      result += c;
      if (c === '\\') {
        if (i + 1 < input.length) result += input[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      result += c;
      i++;
      continue;
    }
    if (c === '/' && i + 1 < input.length && input[i + 1] === '/') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && i + 1 < input.length && input[i + 1] === '*') {
      i += 2;
      while (i + 1 < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

interface ConfigFile {
  modelProfiles?: Record<string, { pricing?: Pricing }>;
}

/**
 * Load pricing data from the plugin's config file.
 * Returns a Map keyed by lowercased model ID. Empty map if config is missing or malformed.
 *
 * Lookup path order:
 * 1. configPath argument (used by tests)
 * 2. process.env.EXTREME_COMPRESS_CONFIG (override)
 * 3. ~/.config/opencode/extreme-compress.jsonc (default)
 */
export async function loadPricingMap(configPath?: string): Promise<Map<string, Pricing>> {
  const path = configPath ?? process.env.EXTREME_COMPRESS_CONFIG ?? DEFAULT_CONFIG_PATH;
  const map = new Map<string, Pricing>();
  try {
    const raw = await readFile(path, 'utf-8');
    const json = stripJsonc(raw);
    const parsed = JSON.parse(json) as ConfigFile;
    const profiles = parsed.modelProfiles ?? {};
    for (const [modelId, profile] of Object.entries(profiles)) {
      if (profile.pricing) {
        map.set(modelId.toLowerCase(), profile.pricing);
      }
    }
  } catch (err) {
    // Config missing or malformed — log to stderr (not throw) so the TUI still works.
    const reason = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[xtui] pricing config unavailable at ${path}: ${reason}\n`);
  }
  return map;
}

/**
 * Look up pricing for a model. Case-insensitive.
 * Returns undefined if model has no pricing entry.
 */
export function findPricing(modelName: string, pricingMap: Map<string, Pricing>): Pricing | undefined {
  return pricingMap.get(modelName.toLowerCase());
}
