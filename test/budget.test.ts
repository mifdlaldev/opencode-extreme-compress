import { describe, test, expect } from 'bun:test';
import { OutputBudgetTracker, checkBudgetLow } from '../src/budget';

describe('output budget tracker', () => {
  test('starts at full capacity', () => {
    const t = new OutputBudgetTracker(8192);
    expect(t.remaining()).toBe(8192);
  });

  test('decrements on record', () => {
    const t = new OutputBudgetTracker(8192);
    t.record(1000);
    expect(t.remaining()).toBe(7192);
  });

  test('caps at 0 remaining', () => {
    const t = new OutputBudgetTracker(100);
    t.record(500);
    expect(t.remaining()).toBe(0);
  });

  test('checkBudgetLow returns true when below threshold', () => {
    const t = new OutputBudgetTracker(8192);
    t.record(6800); // used 83%, remaining 17% < 20%
    expect(checkBudgetLow(t, 0.20)).toBe(true);
  });

  test('checkBudgetLow returns false when above threshold', () => {
    const t = new OutputBudgetTracker(8192);
    t.record(1000);
    expect(checkBudgetLow(t, 0.20)).toBe(false);
  });

  test('ratio returns used/limit', () => {
    const t = new OutputBudgetTracker(1000);
    t.record(250);
    expect(t.ratio()).toBeCloseTo(0.25, 2);
  });

  test('reset clears usage', () => {
    const t = new OutputBudgetTracker(1000);
    t.record(500);
    t.reset();
    expect(t.remaining()).toBe(1000);
  });
});
