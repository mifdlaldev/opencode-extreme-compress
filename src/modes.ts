import type { CompressionMode, PluginConfig } from './types';
import { resolveProfile } from './config';

/**
 * Resolve the effective compression mode for a session.
 *
 * Precedence (highest to lowest):
 * 1. `config.mode` — the user's explicit choice in compress.jsonc (ALWAYS wins)
 * 2. `profile.mode` — model's preferred mode (auto-pick for that model)
 *
 * Why config.mode wins: users explicitly set `mode: "shadow"` expecting
 * shadow behavior. If profile.mode silently overrode this, users would
 * be confused (e.g., "I set shadow but L1 events are firing"). Profile is
 * still used for maxContextUsage, but NOT for picking the compression mode.
 *
 * Special case: if config.mode is unspecified in the future, profile.mode
 * would be used as fallback. For now, config.mode is required.
 */
export function resolveEffectiveMode(config: PluginConfig, _modelId: string): CompressionMode {
  return config.mode;
}

/**
 * @deprecated Use config.mode directly. Kept for backwards compatibility.
 * Returns the profile's suggested mode, but does NOT affect effective mode.
 */
export function suggestedModeForModel(config: PluginConfig, modelId: string): CompressionMode {
  const profile = resolveProfile(config, modelId);
  return profile.mode;
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
