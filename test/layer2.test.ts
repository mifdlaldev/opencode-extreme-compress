import { describe, test, expect } from 'bun:test';
import {
  shouldStrip,
  stripComments,
  compressFileContent,
} from '../src/layers/layer2-file-content';

describe('Layer 2: File Content Stripper', () => {
  test('shouldStrip accepts TypeScript files', () => {
    expect(shouldStrip('src/foo.ts', 5000)).toBe(true);
    expect(shouldStrip('src/bar.tsx', 5000)).toBe(true);
  });

  test('shouldStrip accepts Python files', () => {
    expect(shouldStrip('script.py', 5000)).toBe(true);
  });

  test('shouldStrip rejects .md, .json, .yaml', () => {
    expect(shouldStrip('README.md', 5000)).toBe(false);
    expect(shouldStrip('package.json', 5000)).toBe(false);
    expect(shouldStrip('config.yaml', 5000)).toBe(false);
  });

  test('shouldStrip rejects files smaller than 1KB', () => {
    expect(shouldStrip('src/foo.ts', 500)).toBe(false);
  });

  test('stripComments removes single-line comments', () => {
    const input = 'const a = 1; // comment\nconst b = 2;';
    const result = stripComments(input);
    expect(result).not.toContain('// comment');
    expect(result).toContain('const a = 1');
  });

  test('stripComments removes block comments', () => {
    const input = 'const a = 1; /* block */\nconst b = 2;';
    const result = stripComments(input);
    expect(result).not.toContain('/* block */');
    expect(result).toContain('const a = 1');
  });

  test('stripComments preserves URLs in strings', () => {
    const input = 'const url = "https://example.com";';
    const result = stripComments(input);
    expect(result).toContain('https://example.com');
  });

  test('stripComments preserves function signatures', () => {
    const input = `// header
function validateUser(token: string): boolean {
  // body
  return true;
}`;
    const result = stripComments(input);
    expect(result).toContain('function validateUser');
    expect(result).toContain('(token: string): boolean');
  });

  test('stripComments preserves export statements', () => {
    const input = '// c\nexport function foo() {}\n// c2';
    const result = stripComments(input);
    expect(result).toContain('export function foo');
  });

  test('compressFileContent returns none for non-eligible files', () => {
    const input = 'small content';
    const result = compressFileContent('README.md', input, {
      enabled: true,
      excludeGlobs: [],
    });
    expect(result.method).toBe('none');
  });
});
