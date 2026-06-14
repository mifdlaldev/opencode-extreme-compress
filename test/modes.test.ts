import { describe, test, expect } from 'bun:test';
import { resolveEffectiveMode, shouldApplyLayer, suggestedModeForModel } from '../src/modes';
import type { PluginConfig } from '../src/types';

const baseConfig: PluginConfig = {
  mode: 'light',
  modelProfiles: {
    '*': { mode: 'light', maxContextUsage: 0.95 },
    'minimax-m3': { mode: 'light', maxContextUsage: 0.95 },
    'deepseek-v4-flash-free': { mode: 'medium', maxContextUsage: 0.80 },
  },
  outputBudget: { enabled: true, trackRemaining: true, triggerIfLow: 0.20 },
  propagateToSubagents: { enabled: true, mode: 'inherit', excludeSubagents: [] },
  tokenizer: { strategy: 'auto', modelTokenizers: {} },
  antiHallucination: { enabled: true, mustPreserve: [], verifyPaths: true, verifyIdentifiers: true, failSafe: 'no-compression' },
  layers: {
    toolOutput: { enabled: true, headLines: 200, tailLines: 50, maxBytes: 102400, preservePatterns: [] },
    fileContent: { enabled: false, excludeGlobs: [] },
    semantic: { enabled: false, model: 'kimi-k2.6', trigger: { minMessages: 15, keepRecent: 4 }, maxSummaryTokens: 1500 },
  },
  excludeGlobs: [],
  stats: { enabled: false, path: '/tmp/stats.jsonl', rotateMonthly: false },
};

describe('mode resolution (config.mode wins over profile)', () => {
  test('config.mode = "light" returns light regardless of profile', () => {
    expect(resolveEffectiveMode(baseConfig, 'minimax-m3')).toBe('light');
  });

  test('config.mode = "shadow" returns shadow EVEN FOR FLASH (user explicit choice wins)', () => {
    // CRITICAL: even though flash profile says 'medium', user-set 'shadow' wins
    const cfg = { ...baseConfig, mode: 'shadow' as const };
    expect(resolveEffectiveMode(cfg, 'deepseek-v4-flash-free')).toBe('shadow');
  });

  test('config.mode = "extreme" returns extreme (user can force aggressive)', () => {
    // Even if M3 profile says 'light', user-set 'extreme' wins
    const cfg = { ...baseConfig, mode: 'extreme' as const };
    expect(resolveEffectiveMode(cfg, 'minimax-m3')).toBe('extreme');
  });

  test('config.mode = "off" returns off (disable all compression)', () => {
    const cfg = { ...baseConfig, mode: 'off' as const };
    expect(resolveEffectiveMode(cfg, 'any-model')).toBe('off');
  });
});

describe('suggestedModeForModel (profile-only helper, deprecated)', () => {
  test('returns profile mode (informational only)', () => {
    expect(suggestedModeForModel(baseConfig, 'minimax-m3')).toBe('light');
    expect(suggestedModeForModel(baseConfig, 'deepseek-v4-flash-free')).toBe('medium');
  });
});

describe('layer gating', () => {
  test('off mode applies no layers', () => {
    expect(shouldApplyLayer('off', 'toolOutput')).toBe(false);
    expect(shouldApplyLayer('off', 'fileContent')).toBe(false);
    expect(shouldApplyLayer('off', 'semantic')).toBe(false);
  });

  test('shadow mode applies no layers', () => {
    expect(shouldApplyLayer('shadow', 'toolOutput')).toBe(false);
    expect(shouldApplyLayer('shadow', 'semantic')).toBe(false);
  });

  test('light mode applies only toolOutput', () => {
    expect(shouldApplyLayer('light', 'toolOutput')).toBe(true);
    expect(shouldApplyLayer('light', 'fileContent')).toBe(false);
    expect(shouldApplyLayer('light', 'semantic')).toBe(false);
  });

  test('medium mode applies all layers', () => {
    expect(shouldApplyLayer('medium', 'toolOutput')).toBe(true);
    expect(shouldApplyLayer('medium', 'fileContent')).toBe(true);
    expect(shouldApplyLayer('medium', 'semantic')).toBe(true);
  });

  test('extreme mode applies all layers', () => {
    expect(shouldApplyLayer('extreme', 'toolOutput')).toBe(true);
    expect(shouldApplyLayer('extreme', 'fileContent')).toBe(true);
    expect(shouldApplyLayer('extreme', 'semantic')).toBe(true);
  });
});
