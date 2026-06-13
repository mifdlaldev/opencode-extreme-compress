import { describe, test, expect } from 'bun:test';
import {
  buildSummarizationPrompt,
  verifySummary,
  extractIdentifiers,
  extractPaths,
} from '../src/layers/layer3-semantic';

describe('Layer 3: Semantic Summarizer (non-LLM parts)', () => {
  test('buildSummarizationPrompt includes anti-hallucination anchors', () => {
    const prompt = buildSummarizationPrompt('user did X', 'assistant did Y');
    expect(prompt).toContain('CRITICAL');
    expect(prompt).toContain('file paths');
    expect(prompt).toContain('identifiers');
    expect(prompt).toContain('error messages');
    expect(prompt).toContain('[UNCERTAIN');
  });

  test('buildSummarizationPrompt includes input content', () => {
    const prompt = buildSummarizationPrompt('USER: refactor foo', 'ASSISTANT: refactored');
    expect(prompt).toContain('refactor foo');
    expect(prompt).toContain('refactored');
  });

  test('extractPaths finds relative and absolute paths', () => {
    const text = 'Modified src/auth/login.ts and /home/user/foo.ts';
    const paths = extractPaths(text);
    expect(paths.some((p) => p.includes('auth/login.ts'))).toBe(true);
    expect(paths.some((p) => p.includes('foo.ts'))).toBe(true);
  });

  test('extractIdentifiers finds function names', () => {
    const text = 'Called validateUserToken and getUserById functions';
    const ids = extractIdentifiers(text);
    expect(ids).toContain('validateUserToken');
    expect(ids).toContain('getUserById');
  });

  test('verifySummary detects missing paths', () => {
    const original = 'Modified src/foo.ts and src/bar.ts';
    const summary = 'Modified src/foo.ts';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(false);
    expect(result.missingPaths).toContain('src/bar.ts');
  });

  test('verifySummary passes when all paths preserved', () => {
    const original = 'Modified src/foo.ts and src/bar.ts';
    const summary = 'Modified src/foo.ts and src/bar.ts';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(true);
    expect(result.missingPaths.length).toBe(0);
  });

  test('verifySummary detects missing identifiers', () => {
    const original = 'Called validateUserToken';
    const summary = 'Did some auth';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(false);
    expect(result.missingIdentifiers).toContain('validateUserToken');
  });

  test('verifySummary passes when identifiers preserved', () => {
    const original = 'Called validateUserToken';
    const summary = 'Called validateUserToken successfully';
    const result = verifySummary(original, summary);
    expect(result.passed).toBe(true);
  });
});
