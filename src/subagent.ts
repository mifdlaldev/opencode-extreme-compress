import type { PluginConfig, CompressionMode } from './types';

export function resolveSubagentMode(
  config: PluginConfig,
  parentMode: CompressionMode,
  subagentName: string
): CompressionMode {
  const sub = config.propagateToSubagents;
  if (!sub.enabled) return 'off';

  if (sub.excludeSubagents.includes(subagentName)) return 'off';

  switch (sub.mode) {
    case 'inherit':
      return parentMode;
    case 'force-off':
      return 'off';
    case 'force-light':
      return 'light';
    case 'force-medium':
      return 'medium';
  }
}

export function shouldCompressForSubagent(
  config: PluginConfig,
  parentMode: CompressionMode,
  subagentName: string
): boolean {
  const resolved = resolveSubagentMode(config, parentMode, subagentName);
  return resolved !== 'off' && resolved !== 'shadow';
}
