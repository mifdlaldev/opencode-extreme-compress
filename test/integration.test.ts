import { describe, test, expect } from 'bun:test';
import { loadConfig } from '../src/config';
import { compressToolOutput } from '../src/layers/layer1-tool-output';
import { compressFileContent } from '../src/layers/layer2-file-content';
import { resolveEffectiveMode } from '../src/modes';

describe('Integration tests', () => {
  test('1. full pipeline: load config + apply Layer 1', async () => {
    const config = await loadConfig();
    const input = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const result = compressToolOutput(input, 'bash', config.layers.toolOutput);
    expect(result.method).toBe('truncate');
    expect(result.compressedInputTokens).toBeLessThan(result.inputTokens);
  });

  test('2. mode change resolves correctly per model', () => {
    const config = {
      mode: 'light' as const,
      modelProfiles: {
        '*': { maxContextUsage: 0.95 },
        'minimax-m3': { maxContextUsage: 0.95 },
        'deepseek-v4-flash-free': { maxContextUsage: 0.8 },
      },
    };

    expect(resolveEffectiveMode(config as any, 'minimax-m3')).toBe('light');
    expect(resolveEffectiveMode(config as any, 'deepseek-v4-flash-free')).toBe('light');
  });

  test('3. AGENTS.md-like content too small for compression', () => {
    const input = 'small AGENTS.md content';
    const result = compressToolOutput(input, 'read', {
      enabled: true,
      headLines: 200,
      tailLines: 50,
      maxBytes: 102400,
      preservePatterns: [],
    });
    expect(result.method).toBe('none');
  });

  test('4. emergency byte truncation triggers for huge input', () => {
    const hugeInput = 'x'.repeat(2_000_000);
    const result = compressToolOutput(hugeInput, 'bash', {
      enabled: true,
      headLines: 200,
      tailLines: 50,
      maxBytes: 102400,
      preservePatterns: [],
    });
    expect(result.method).toBe('truncate');
    expect(Buffer.byteLength(result.compressed, 'utf-8')).toBeLessThanOrEqual(102400);
  });

  test('5. file content compression respects exclude globs', () => {
    const jsonInput = '{"foo": "bar"}';
    const result = compressFileContent('package.json', jsonInput, {
      enabled: true,
      excludeGlobs: ['*.json'],
    });
    expect(result.method).toBe('none');
  });
});
