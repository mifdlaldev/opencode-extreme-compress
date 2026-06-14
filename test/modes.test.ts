import { describe, test, expect } from 'bun:test';
import { resolveEffectiveMode, shouldApplyLayer } from '../src/modes';
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

describe('mode resolution', () => {
  test('resolveEffectiveMode returns profile mode for known model', () => {
    expect(resolveEffectiveMode(baseConfig, 'minimax-m3')).toBe('light');
  });

  test('resolveEffectiveMode returns medium for flash model', () => {
    expect(resolveEffectiveMode(baseConfig, 'deepseek-v4-flash-free')).toBe('medium');
  });

  test('resolveEffectiveMode falls back to * for unknown model', () => {
    expect(resolveEffectiveMode(baseConfig, 'unknown-xyz')).toBe('light');
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
