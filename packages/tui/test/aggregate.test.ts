import { describe, test, expect } from 'bun:test';
import { aggregateOverall, aggregateBySession } from '../src/lib/aggregate.js';
import type { StatsEvent } from '../src/lib/types.js';

describe('aggregateOverall', () => {
  test('empty events returns zeros', () => {
    const r = aggregateOverall([]);
    expect(r.totalSessions).toBe(0);
    expect(r.avgRatio).toBe(0);
  });

  test('computes totals from mixed events', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', orig: 1000, comp: 200, ratio: 0.8 },
      { ts: 3, type: 'L1', sessionId: 's1', tool: 'bash', orig: 500, comp: 100, ratio: 0.8 },
      { ts: 4, type: 'L3', sessionId: 's1', orig: 5000, comp: 1000, ratio: 0.8, verified: true },
      { ts: 5, type: 'session.end', sessionId: 's1', durationMs: 60000 },
    ];
    const r = aggregateOverall(events);
    expect(r.totalSessions).toBe(1);
    expect(r.totalOrig).toBe(6500);
    expect(r.totalSaved).toBe(5200);
    expect(r.avgRatio).toBeCloseTo(0.8);
    expect(r.byModel.length).toBe(1);
    expect(r.byModel[0].model).toBe('minimax-m3');
    expect(r.byLayer.length).toBe(2);
  });

  test('groups by model', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', orig: 1000, comp: 200, ratio: 0.8 },
      { ts: 10, type: 'session.start', sessionId: 's2', model: 'deepseek-flash', mode: 'medium' },
      { ts: 11, type: 'L1', sessionId: 's2', tool: 'read', orig: 500, comp: 100, ratio: 0.8 },
    ];
    const r = aggregateOverall(events);
    expect(r.byModel.length).toBe(2);
  });
});
