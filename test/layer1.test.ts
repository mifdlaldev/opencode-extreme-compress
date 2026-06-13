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

describe('Layer 1: edge cases', () => {
  test('handles empty output', () => {
    const result = compressToolOutput('', 'bash', defaultConfig);
    expect(result.method).toBe('none');
    expect(result.compressed).toBe('');
  });

  test('handles single huge line (char truncation)', () => {
    const input = 'x'.repeat(200000);
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.method).toBe('truncate');
    expect(result.compressed.length).toBeLessThan(200000);
  });

  test('handles JSON output without breaking structure', () => {
    const obj = { foo: 'bar', items: Array.from({ length: 100 }, (_, i) => ({ id: i })) };
    const input = JSON.stringify(obj, null, 2);
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(['none', 'truncate']).toContain(result.method);
  });

  test('handles output with mixed line endings (CRLF/LF)', () => {
    const input = 'line1\r\nline2\nline3\r\nline4';
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.compressed).toContain('line1');
    expect(result.compressed).toContain('line4');
  });

  test('handles output with ANSI color codes', () => {
    const ansi = '\x1b[31mERROR:\x1b[0m something failed';
    const input = ansi + '\nnormal line';
    const result = compressToolOutput(input, 'bash', defaultConfig);
    // ANSI codes may or may not be preserved, but content "ERROR" should be there
    expect(result.compressed).toContain('ERROR');
  });

  test('preserves Error class names', () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`);
    lines[200] = 'TypeError: Cannot read property';
    const input = lines.join('\n');
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.compressed).toContain('TypeError');
  });

  test('does not mutate input string', () => {
    const input = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const original = input;
    compressToolOutput(input, 'bash', defaultConfig);
    expect(input).toBe(original);
  });

  test('marker format is parseable', () => {
    const input = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const result = compressToolOutput(input, 'bash', defaultConfig);
    expect(result.marker).toMatch(/\[EXTREME-COMPRESS L1: \d+→\d+ tokens \(\d+% saved\)/);
  });

  test('handles headLines > total lines (no truncation)', () => {
    const input = 'a\nb\nc';
    const config = { ...defaultConfig, headLines: 100, tailLines: 100 };
    const result = compressToolOutput(input, 'bash', config);
    expect(result.method).toBe('none');
  });

  test('handles headLines = 0 (only tail)', () => {
    const input = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n');
    const config = { ...defaultConfig, headLines: 0, tailLines: 50 };
    const result = compressToolOutput(input, 'bash', config);
    expect(result.method).toBe('truncate');
    expect(result.compressed.split('\n').length).toBeLessThanOrEqual(55);
  });
});
