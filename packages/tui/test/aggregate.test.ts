import { describe, test, expect } from 'bun:test';
import { aggregateOverall, aggregateBySession } from '../src/lib/aggregate.js';
import type { StatsEvent } from '../src/lib/types.js';

describe('aggregateOverall', () => {
  test('empty events returns zeros', () => {
    const r = aggregateOverall([]);
    expect(r.totalSessions).toBe(0);
    expect(r.avgRatio).toBe(0);
    expect(r.totalInputTokens).toBe(0);
    expect(r.totalOutputTokens).toBe(0);
  });

  test('computes totals from mixed events', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'L1', sessionId: 's1', tool: 'bash', inputTokens: 500, compressedInputTokens: 100, ratio: 0.8, method: 'truncate' },
      { ts: 4, type: 'L3', sessionId: 's1', inputTokens: 5000, compressedInputTokens: 1000, ratio: 0.8, verified: true },
      { ts: 5, type: 'session.end', sessionId: 's1', durationMs: 60000, totalInputTokens: 1300, totalOriginalInputTokens: 6500, totalOutputTokens: 800 },
    ];
    const r = aggregateOverall(events);
    expect(r.totalSessions).toBe(1);
    expect(r.totalOriginalInputTokens).toBe(6500);
    expect(r.totalInputTokens).toBe(1300);
    expect(r.totalOutputTokens).toBe(800);
    expect(r.totalSaved).toBe(5200);
    expect(r.avgRatio).toBeCloseTo(0.8);
    expect(r.byModel.length).toBe(1);
    expect(r.byModel[0].model).toBe('minimax-m3');
    expect(r.byModel[0].totalOriginalInputTokens).toBe(6500);
    expect(r.byModel[0].totalInputTokens).toBe(1300);
    expect(r.byModel[0].totalOutputTokens).toBe(800);
    expect(r.byLayer.length).toBe(2);
  });

  test('groups by model', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 10, type: 'session.start', sessionId: 's2', model: 'deepseek-flash', mode: 'medium' },
      { ts: 11, type: 'L1', sessionId: 's2', tool: 'read', inputTokens: 500, compressedInputTokens: 100, ratio: 0.8, method: 'truncate' },
    ];
    const r = aggregateOverall(events);
    expect(r.byModel.length).toBe(2);
  });

  test('handles session.end with totals', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' },
      { ts: 100, type: 'session.end', sessionId: 's1', durationMs: 5000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50 },
    ];
    const r = aggregateOverall(events);
    expect(r.totalInputTokens).toBe(100);
    expect(r.totalOriginalInputTokens).toBe(200);
    expect(r.totalOutputTokens).toBe(50);
    expect(r.totalSaved).toBe(100);
  });
});
