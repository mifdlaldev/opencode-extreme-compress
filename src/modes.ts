import type { CompressionMode, PluginConfig } from './types';
import { resolveProfile } from './config';

export function resolveEffectiveMode(config: PluginConfig, modelId: string): CompressionMode {
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
