import type { CompressionMode, PluginConfig } from './types';

/**
 * Resolve the effective compression mode for a session.
 *
 * config.mode is the user's explicit choice in compress.jsonc and always wins.
 * Profile.mode was removed in v0.2.4 because it silently overrode the user's
 * choice (e.g., user-set "shadow" was overridden to "light" by M3 profile).
 * Profile.maxContextUsage is still used for output budget tracking.
 */
export function resolveEffectiveMode(config: PluginConfig, _modelId: string): CompressionMode {
  return config.mode;
}

export function shouldApplyLayer(
  mode: CompressionMode,
  layer: 'toolOutput' | 'fileContent' | 'semantic'
): boolean {
  if (mode === 'off' || mode === 'shadow') return false;
  if (mode === 'light') return layer === 'toolOutput';
  // medium, extreme: all layers
  return true;
}
