import { describe, test, expect } from 'bun:test';
import { countTokens, estimateReduction, bytesToApproxTokens } from '../src/utils/token-counter';

describe('token counter', () => {
  test('countTokens uses chars/4 approximation', () => {
    const text = 'a'.repeat(1000);
    const count = countTokens(text);
    expect(count).toBe(250);
  });

  test('countTokens handles empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  test('countTokens handles short text', () => {
    // 'hi' = 2 chars → 2/4 = 0.5, ceil = 1
    expect(countTokens('hi')).toBe(1);
  });

  test('countTokens handles unicode (emoji)', () => {
    const count = countTokens('😀😁😂🤣');
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('countTokens uses ceil (never underestimates)', () => {
    // 5 chars → 5/4 = 1.25, must be at least 2 (not 1)
    expect(countTokens('hello')).toBe(2);
  });

  test('estimateReduction returns ratio', () => {
    const ratio = estimateReduction(1000, 250);
    expect(ratio).toBeCloseTo(0.75, 2);
  });

  test('estimateReduction returns 0 when original is 0', () => {
    expect(estimateReduction(0, 0)).toBe(0);
    expect(estimateReduction(0, 100)).toBe(0);
  });

  test('estimateReduction handles zero compressed', () => {
    expect(estimateReduction(1000, 0)).toBe(1);
  });

  test('bytesToApproxTokens converts correctly', () => {
    expect(bytesToApproxTokens(4000)).toBe(1000);
    expect(bytesToApproxTokens(0)).toBe(0);
    expect(bytesToApproxTokens(1)).toBe(1); // ceil
  });
});
