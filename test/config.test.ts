import { describe, test, expect } from 'bun:test';
import {
  loadConfig,
  getDefaultConfig,
  resolveProfile,
  stripJsoncComments,
  deepMerge,
} from '../src/config';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

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

  test('loadConfig with undefined path returns defaults', async () => {
    const config = await loadConfig(undefined);
    expect(config.mode).toBe('light');
  });

  test('loadConfig with path containing ".." returns defaults (security)', async () => {
    const config = await loadConfig('/foo/../etc/passwd');
    expect(config.mode).toBe('light');
  });

  test('loadConfig parses JSONC with comments', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'config-test-'));
    const configPath = join(tmp, 'test.jsonc');
    try {
      writeFileSync(
        configPath,
        `{
          // line comment
          "mode": "extreme",
          /* block comment */
          "layers": {
            "toolOutput": { "headLines": 100 }
          }
        }`
      );
      const config = await loadConfig(configPath);
      expect(config.mode).toBe('extreme');
      // headLines overridden, tailLines preserved from defaults (deep merge)
      expect(config.layers.toolOutput.headLines).toBe(100);
      expect(config.layers.toolOutput.tailLines).toBe(50);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('loadConfig preserves nested defaults when partially overridden', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'config-test-'));
    const configPath = join(tmp, 'partial.jsonc');
    try {
      writeFileSync(
        configPath,
        JSON.stringify({
          tokenizer: { strategy: 'chars4' },
        })
      );
      const config = await loadConfig(configPath);
      // modelTokenizers from defaults preserved (deep merge)
      expect(config.tokenizer.modelTokenizers['minimax-m3']).toBe('chars4');
      expect(config.tokenizer.strategy).toBe('chars4');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('loadConfig with malformed JSON returns defaults (fail-safe)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'config-test-'));
    const configPath = join(tmp, 'bad.jsonc');
    try {
      writeFileSync(configPath, '{ "mode": "extreme",'); // unclosed
      const config = await loadConfig(configPath);
      expect(config.mode).toBe('light'); // fell back to default
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('resolveProfile', () => {
  const config = getDefaultConfig();

  test('returns exact match for known model', () => {
    const profile = resolveProfile(config, 'minimax-m3');
    expect(profile.mode).toBe('light');
  });

  test('returns flash profile for flash model', () => {
    const profile = resolveProfile(config, 'deepseek-v4-flash-free');
    expect(profile.mode).toBe('medium');
  });

  test('falls back to "*" for unknown model', () => {
    const profile = resolveProfile(config, 'unknown-model-xyz');
    expect(profile.mode).toBe('light'); // * default
    expect(profile.maxContextUsage).toBe(0.95);
  });
});

describe('stripJsoncComments', () => {
  test('strips single-line comments', () => {
    const input = `{ "a": 1 } // trailing comment`;
    const result = stripJsoncComments(input);
    expect(result).toBe('{ "a": 1 } ');
  });

  test('strips block comments', () => {
    const input = `{ /* comment */ "a": 1 }`;
    const result = stripJsoncComments(input);
    expect(result).toBe('{  "a": 1 }');
  });

  test('preserves // inside string literals', () => {
    const input = `{ "url": "https://example.com" }`;
    const result = stripJsoncComments(input);
    expect(result).toBe(input);
  });

  test('preserves /* inside string literals', () => {
    const input = `{ "desc": "a /* b */ c" }`;
    const result = stripJsoncComments(input);
    expect(result).toBe(input);
  });

  test('handles escaped quotes in strings', () => {
    const input = `{ "msg": "he said \\"hello // world\\"" }`;
    const result = stripJsoncComments(input);
    expect(result).toBe(input);
  });

  test('handles nested block comments', () => {
    const input = `/* outer /* inner */ rest */ "a": 1`;
    // Note: nested block comments are NOT supported by JSON spec;
    // we just verify we don't hang.
    const result = stripJsoncComments(input);
    expect(result).toContain('"a": 1');
  });
});

describe('deepMerge', () => {
  test('merges nested objects recursively', () => {
    const target: Record<string, unknown> = {
      a: { x: 1, y: 2 },
      b: 'keep',
    };
    const source: Record<string, unknown> = { a: { y: 20, z: 3 } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { x: 1, y: 20, z: 3 }, b: 'keep' });
  });

  test('replaces arrays (does not concatenate)', () => {
    const target = { items: [1, 2, 3] };
    const source = { items: [9] };
    const result = deepMerge(target, source);
    expect(result.items).toEqual([9]);
  });

  test('skips undefined values in source', () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, b: 20 };
    const result = deepMerge(target, source);
    expect(result.a).toBe(1); // preserved
    expect(result.b).toBe(20); // updated
  });

  test('applies null values (does not skip)', () => {
    const target: Record<string, unknown> = { a: { x: 1 } };
    const source: Record<string, unknown> = { a: null };
    const result = deepMerge(target, source);
    expect(result.a).toBeNull();
  });

  test('handles undefined source gracefully', () => {
    const target: Record<string, unknown> = { a: 1 };
    const result = deepMerge(target, undefined);
    expect(result).toEqual({ a: 1 });
  });
});
