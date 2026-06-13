import { describe, test, expect } from 'bun:test';
import { loadConfig, getDefaultConfig } from '../src/config';

describe('config loader', () => {
  test('getDefaultConfig returns light mode with safe defaults', () => {
    const config = getDefaultConfig();
    expect(config.mode).toBe('light');
    expect(config.antiHallucination.enabled).toBe(true);
    expect(config.layers.toolOutput.enabled).toBe(true);
    expect(config.layers.fileContent.enabled).toBe(false);
    expect(config.layers.semantic.enabled).toBe(false);
  });

  test('getDefaultConfig has model profiles', () => {
    const config = getDefaultConfig();
    expect(config.modelProfiles['*']).toBeDefined();
    expect(config.modelProfiles['minimax-m3']).toBeDefined();
    expect(config.modelProfiles['deepseek-v4-flash-free']).toBeDefined();
  });

  test('getDefaultConfig has flash profile set to medium by default', () => {
    const config = getDefaultConfig();
    expect(config.modelProfiles['deepseek-v4-flash-free'].mode).toBe('medium');
  });

  test('loadConfig with missing file returns defaults', async () => {
    const config = await loadConfig('/nonexistent/path.jsonc');
    expect(config.mode).toBe('light');
  });
});
