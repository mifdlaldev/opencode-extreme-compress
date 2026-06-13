import { describe, test, expect } from 'bun:test';
import { compressToolOutput } from '../src/layers/layer1-tool-output';
import type { ToolOutputConfig } from '../src/types';

const defaultConfig: ToolOutputConfig = {
  enabled: true,
  headLines: 200,
  tailLines: 50,
  maxBytes: 102400,
  preservePatterns: [
    '(?i)(error|fail|exception|warning)',
    '\\b\\w+\\.ts:\\d+:',
    '\\b[A-Z][a-zA-Z]+Error\\b',
  ],
};

describe('Layer 1: Tool Output Filter', () => {
  test('keeps output under threshold unchanged', () => {
    const input = 'line1\nline2\nline3';
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.compressed).toBe(input);
    expect(result.method).toBe('none');
    expect(result.ratio).toBe(0);
  });

  test('truncates when exceeding line threshold', () => {
    const input = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.method).toBe('truncate');
    // Should keep head + tail + marker = 200 + 50 + 1 marker = ~251 lines
    expect(result.compressed.split('\n').length).toBeLessThan(5000);
    expect(result.compressed).toContain('lines hidden');
  });

  test('preserves error lines during truncation', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
    lines[500] = 'ERROR: critical failure';
    lines[800] = 'Error: something else';
    const input = lines.join('\n');
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.compressed).toContain('ERROR: critical failure');
    expect(result.compressed).toContain('Error: something else');
  });

  test('preserves file:line:col references during truncation', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
    lines[100] = 'src/auth/login.ts:42: error TS2304';
    const input = lines.join('\n');
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.compressed).toContain('src/auth/login.ts:42');
  });

  test('truncates by bytes when output exceeds maxBytes', () => {
    const input = 'a'.repeat(200000);
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.method).toBe('truncate');
    expect(result.compressed.length).toBeLessThan(200000);
    expect(result.compressed).toContain('truncated');
  });
});
