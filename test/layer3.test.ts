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

import { summarizeWithRetry, type SummarizerClient } from '../src/layers/layer3-semantic';

describe('Layer 3: summarizeWithRetry (mocked LLM)', () => {
  function createMockClient(response: string, failFirstN: number = 0): SummarizerClient {
    let calls = 0;
    return {
      prompt: async () => {
        calls++;
        if (calls <= failFirstN) {
          throw new Error('Mocked LLM failure');
        }
        return response;
      },
    };
  }

  test('returns summary on first success', async () => {
    const client = createMockClient('src/foo.ts validateUserToken called');
    const result = await summarizeWithRetry('src/foo.ts validateUserToken called', client);
    expect(result.summary).toBe('src/foo.ts validateUserToken called');
    expect(result.attempts).toBe(1);
    expect(result.fellBack).toBe(false);
    expect(result.verificationPassed).toBe(true);
  });

  test('retries on failure then succeeds', async () => {
    const client = createMockClient('src/foo.ts validateUserToken', 1);
    const result = await summarizeWithRetry('src/foo.ts validateUserToken', client);
    expect(result.attempts).toBe(2);
    expect(result.summary).toBe('src/foo.ts validateUserToken');
    expect(result.fellBack).toBe(false);
  });

  test('falls back after max retries', async () => {
    const client = createMockClient('', 5);
    const result = await summarizeWithRetry('any original', client, { maxRetries: 2 });
    expect(result.attempts).toBe(3); // initial + 2 retries
    expect(result.fellBack).toBe(true);
    expect(result.summary).toBeNull();
  });

  test('falls back when verification fails', async () => {
    // Mock returns a summary that fails verification (missing paths)
    const client = createMockClient('vague summary');
    const original = 'src/foo.ts validateUserToken';
    const result = await summarizeWithRetry(original, client, { maxRetries: 1 });
    expect(result.fellBack).toBe(true);
    expect(result.summary).toBeNull();
    expect(result.verificationPassed).toBe(false);
  });
});
