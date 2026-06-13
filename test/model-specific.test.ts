import { describe, test, expect } from 'bun:test';
import { loadConfig } from '../src/config';
import { resolveEffectiveMode, shouldApplyLayer } from '../src/modes';

describe('Model-specific behavior', () => {
  test('1. flash model auto-promotes to medium mode', async () => {
    const config = await loadConfig();
    const mode = resolveEffectiveMode(config, 'deepseek-v4-flash-free');
    expect(mode).toBe('medium');
  });

  test('2. M3 model stays at light mode by default', async () => {
    const config = await loadConfig();
    const mode = resolveEffectiveMode(config, 'minimax-m3');
    expect(mode).toBe('light');
  });

  test('3. unknown model falls back to * profile', async () => {
    const config = await loadConfig();
    const mode = resolveEffectiveMode(config, 'unknown-model-xyz');
    expect(mode).toBe('light');
  });

  test('4. flash model triggers all layers in medium mode', async () => {
    const config = await loadConfig();
    const mode = resolveEffectiveMode(config, 'deepseek-v4-flash-free');
    expect(shouldApplyLayer(mode, 'toolOutput')).toBe(true);
    expect(shouldApplyLayer(mode, 'fileContent')).toBe(true);
    expect(shouldApplyLayer(mode, 'semantic')).toBe(true);
  });

  test('5. light mode only triggers toolOutput layer', async () => {
    expect(shouldApplyLayer('light', 'toolOutput')).toBe(true);
    expect(shouldApplyLayer('light', 'fileContent')).toBe(false);
    expect(shouldApplyLayer('light', 'semantic')).toBe(false);
  });
});
