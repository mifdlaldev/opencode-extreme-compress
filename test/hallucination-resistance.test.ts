import { describe, test, expect } from 'bun:test';
import { compressToolOutput } from '../src/layers/layer1-tool-output';
import { stripComments } from '../src/layers/layer2-file-content';
import { extractPaths, extractIdentifiers, verifySummary } from '../src/layers/layer3-semantic';
import type { ToolOutputConfig } from '../src/types';

const toolConfig: ToolOutputConfig = {
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

describe('Hallucination resistance — MUST PASS (BLOCKING)', () => {
  test('1. preserves error messages verbatim', () => {
    const input = 'TypeError: Cannot read property "foo" of undefined at line 42';
    const result = compressToolOutput(input, 'bash', toolConfig);
    expect(result.compressed).toContain('TypeError');
    expect(result.compressed).toContain('foo');
    expect(result.compressed).toContain('42');
  });

  test('2. preserves file paths', () => {
    const input = 'src/auth/login.ts:15: error TS2304';
    const result = compressToolOutput(input, 'bash', toolConfig);
    expect(result.compressed).toContain('src/auth/login.ts');
    expect(result.compressed).toContain('15');
    expect(result.compressed).toContain('TS2304');
  });

  test('3. preserves identifiers and function names', () => {
    const input = 'function validateUserToken(token: string): boolean';
    const result = compressToolOutput(input, 'bash', toolConfig);
    expect(result.compressed).toContain('validateUserToken');
    expect(result.compressed).toContain('token');
    expect(result.compressed).toContain('string');
    expect(result.compressed).toContain('boolean');
  });

  test('4. preserves numeric values', () => {
    const input = 'Array has 42 items, max 100';
    const result = compressToolOutput(input, 'bash', toolConfig);
    expect(result.compressed).toContain('42');
    expect(result.compressed).toContain('100');
  });

  test('5. preserves config keys', () => {
    const input = 'OPENAI_API_KEY must be set in .env';
    const result = compressToolOutput(input, 'bash', toolConfig);
    expect(result.compressed).toContain('OPENAI_API_KEY');
    expect(result.compressed).toContain('.env');
  });

  test('6. Layer 3 summary retains ALL file paths', () => {
    const original = 'Modified src/foo.ts and src/bar.ts and src/baz/qux.ts';
    const summary = 'Refactored src/foo.ts, src/bar.ts, src/baz/qux.ts';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(true);
  });

  test('7. Layer 3 summary retains ALL identifiers', () => {
    const original = 'Called validateUserToken getUserById hashPassword';
    const summary = 'Used validateUserToken, getUserById, hashPassword';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(true);
  });

  test('8. Layer 1 truncation includes clear marker with line count', () => {
    const input = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const result = compressToolOutput(input, 'bash', toolConfig);
    expect(result.marker).toMatch(/\[\.\.\. \d+ lines hidden/);
  });

  test('9. Tool input is NEVER modified by extreme-compress before-hook', async () => {
    const source = await Bun.file('src/hooks/tool-execute-before.ts').text();
    // Verify no assignment to output.args in before-hook
    expect(source).not.toMatch(/output\s*\.\s*args\s*=/);
  });

  test('10. stripComments preserves strings containing //', () => {
    const input = 'const url = "https://example.com"; const other = "no comments";';
    const result = stripComments(input);
    expect(result).toContain('https://example.com');
    expect(result).toContain('no comments');
  });

  test('11. extractPaths finds paths in mixed content', () => {
    const text = 'Error in src/auth.ts:10, also check /home/user/config.json and ./local.ts';
    const paths = extractPaths(text);
    expect(paths.some((p) => p.includes('auth.ts'))).toBe(true);
  });

  test('12. extractIdentifiers finds function calls', () => {
    const text = 'Called validateUser() and hashPassword(input)';
    const ids = extractIdentifiers(text);
    expect(ids).toContain('validateUser');
    expect(ids).toContain('hashPassword');
  });

  test('13. verification detects missing path', () => {
    const original = 'Modified src/foo.ts and src/bar.ts';
    const summary = 'Modified src/foo.ts';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(false);
    expect(result.missingPaths).toContain('src/bar.ts');
  });

  test('14. verification detects missing identifier', () => {
    const original = 'Called validateUserToken';
    const summary = 'Did auth stuff';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(false);
    expect(result.missingIdentifiers).toContain('validateUserToken');
  });

  test('15. file content stripper preserves function signature with type annotations', () => {
    const input = `// header
function processUserData(userId: string, options: ProcessOptions): Promise<Result> {
  // body
  return Promise.resolve();
}`;
    const result = stripComments(input);
    expect(result).toContain('function processUserData');
    expect(result).toContain('userId: string');
    expect(result).toContain('Promise<Result>');
  });
});
