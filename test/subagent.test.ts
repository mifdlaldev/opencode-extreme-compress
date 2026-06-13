import { describe, test, expect } from 'bun:test';
import { resolveSubagentMode, shouldCompressForSubagent } from '../src/subagent';
import type { PluginConfig } from '../src/types';

const baseConfig: PluginConfig = {
  mode: 'light',
  modelProfiles: { '*': { mode: 'light', maxContextUsage: 0.95 } },
  outputBudget: { enabled: true, trackRemaining: true, triggerIfLow: 0.20 },
  propagateToSubagents: { enabled: true, mode: 'inherit', excludeSubagents: ['oracle'] },
  tokenizer: { strategy: 'auto', modelTokenizers: {} },
  antiHallucination: { enabled: true, mustPreserve: [], verifyPaths: true, verifyIdentifiers: true, failSafe: 'no-compression' },
  layers: {
    toolOutput: { enabled: true, headLines: 200, tailLines: 50, maxBytes: 102400, preservePatterns: [] },
    fileContent: { enabled: false, excludeGlobs: [] },
    semantic: { enabled: false, model: 'kimi-k2.6', trigger: { minMessages: 15, keepRecent: 4 }, maxSummaryTokens: 1500 },
  },
  excludeGlobs: [],
};

describe('subagent propagation', () => {
  test('inherits parent mode by default', () => {
    expect(resolveSubagentMode(baseConfig, 'light', 'explore')).toBe('light');
  });

  test('excluded subagent returns off', () => {
    expect(resolveSubagentMode(baseConfig, 'light', 'oracle')).toBe('off');
  });

  test('force-light overrides parent', () => {
    const c = { ...baseConfig, propagateToSubagents: { ...baseConfig.propagateToSubagents, mode: 'force-light' as const } };
    expect(resolveSubagentMode(c, 'medium', 'explore')).toBe('light');
  });

  test('force-off overrides parent', () => {
    const c = { ...baseConfig, propagateToSubagents: { ...baseConfig.propagateToSubagents, mode: 'force-off' as const } };
    expect(resolveSubagentMode(c, 'medium', 'explore')).toBe('off');
  });

  test('disabled propagation returns off for all', () => {
    const c = { ...baseConfig, propagateToSubagents: { ...baseConfig.propagateToSubagents, enabled: false } };
    expect(resolveSubagentMode(c, 'medium', 'explore')).toBe('off');
  });
});

describe('shouldCompressForSubagent', () => {
  test('returns false when mode is off', () => {
    expect(shouldCompressForSubagent(baseConfig, 'off', 'explore')).toBe(false);
  });

  test('returns false when mode is shadow', () => {
    expect(shouldCompressForSubagent(baseConfig, 'shadow', 'explore')).toBe(false);
  });

  test('returns true for active mode + non-excluded', () => {
    expect(shouldCompressForSubagent(baseConfig, 'light', 'explore')).toBe(true);
  });

  test('returns false for excluded subagent even with active mode', () => {
    expect(shouldCompressForSubagent(baseConfig, 'light', 'oracle')).toBe(false);
  });
});
