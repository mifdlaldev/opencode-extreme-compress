import { describe, test, expect } from 'bun:test';
import { loadConfig } from '../src/config';
import { resolveEffectiveMode, shouldApplyLayer, suggestedModeForModel } from '../src/modes';

describe('Model-specific behavior (config.mode wins over profile)', () => {
  test('1. config.mode = "light" → flash uses light (not profile medium)', async () => {
    const config = await loadConfig();
    expect(config.mode).toBe('light');  // default config is light
    // FLASH would have used 'medium' under the old (profile-wins) behavior.
    // Now under the new (config-wins) behavior, it uses 'light' from config.
    const mode = resolveEffectiveMode(config, 'deepseek-v4-flash-free');
    expect(mode).toBe('light');
  });

  test('2. M3 model uses config.mode (light by default)', async () => {
    const config = await loadConfig();
    const mode = resolveEffectiveMode(config, 'minimax-m3');
    expect(mode).toBe('light');
  });

  test('3. unknown model uses config.mode (fallback is config, not profile)', async () => {
    const config = await loadConfig();
    const mode = resolveEffectiveMode(config, 'unknown-model-xyz');
    expect(mode).toBe('light');
  });

  test('4. config.mode = "extreme" → flash uses extreme (user can force all layers)', async () => {
    const config = { ...(await loadConfig()), mode: 'extreme' as const };
    const mode = resolveEffectiveMode(config, 'deepseek-v4-flash-free');
    expect(mode).toBe('extreme');
    expect(shouldApplyLayer(mode, 'toolOutput')).toBe(true);
    expect(shouldApplyLayer(mode, 'fileContent')).toBe(true);
    expect(shouldApplyLayer(mode, 'semantic')).toBe(true);
  });

  test('5. light mode only triggers toolOutput layer', () => {
    expect(shouldApplyLayer('light', 'toolOutput')).toBe(true);
    expect(shouldApplyLayer('light', 'fileContent')).toBe(false);
    expect(shouldApplyLayer('light', 'semantic')).toBe(false);
  });

  test('6. suggestedModeForModel still returns profile preference (informational)', async () => {
    const config = await loadConfig();
    expect(suggestedModeForModel(config, 'deepseek-v4-flash-free')).toBe('medium');
    expect(suggestedModeForModel(config, 'minimax-m3')).toBe('light');
  });
});
