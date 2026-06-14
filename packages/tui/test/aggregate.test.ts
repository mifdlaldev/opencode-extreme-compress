import { describe, test, expect } from 'bun:test';
import { aggregateOverall, aggregateBySession } from '../src/lib/aggregate.js';
import type { StatsEvent, Pricing } from '../src/lib/types.js';

const emptyPricing = new Map<string, Pricing>();

describe('aggregateOverall', () => {
  test('empty events returns zeros', () => {
    const r = aggregateOverall([], emptyPricing);
    expect(r.totalSessions).toBe(0);
    expect(r.avgRatio).toBe(0);
    expect(r.totalInputTokens).toBe(0);
    expect(r.totalOutputTokens).toBe(0);
    expect(r.costTotal).toBe(0);
    expect(r.costTotalOriginal).toBe(0);
    expect(r.costSaved).toBe(0);
    expect(r.modelsWithPricing).toBe(0);
  });

  test('computes totals from mixed events', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'L1', sessionId: 's1', tool: 'bash', inputTokens: 500, compressedInputTokens: 100, ratio: 0.8, method: 'truncate' },
      { ts: 4, type: 'L3', sessionId: 's1', inputTokens: 5000, compressedInputTokens: 1000, ratio: 0.8, verified: true },
      { ts: 5, type: 'session.end', sessionId: 's1', durationMs: 60000, totalInputTokens: 1300, totalOriginalInputTokens: 6500, totalOutputTokens: 800 },
    ];
    const r = aggregateOverall(events, emptyPricing);
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
    const r = aggregateOverall(events, emptyPricing);
    expect(r.byModel.length).toBe(2);
  });

  test('handles session.end with totals', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 100, type: 'session.end', sessionId: 's1', durationMs: 5000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50 },
    ];
    const r = aggregateOverall(events, emptyPricing);
    expect(r.totalInputTokens).toBe(200);
    expect(r.totalOriginalInputTokens).toBe(1000);
    expect(r.totalOutputTokens).toBe(50);
    expect(r.totalSaved).toBe(800);
  });
});

describe('aggregateOverall with pricing', () => {
  const pricingMap = new Map<string, Pricing>([
    ['minimax-m3', { inputPerMTok: 0.30, outputPerMTok: 1.20, currency: 'USD', source: 'test' }],
    ['free-model', { inputPerMTok: 0, outputPerMTok: 0, currency: 'USD', source: 'test' }],
  ]);

  test('computes cost saved per model', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1_000_000, compressedInputTokens: 200_000, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 200_000, totalOriginalInputTokens: 1_000_000, totalOutputTokens: 500_000 },
    ];
    const r = aggregateOverall(events, pricingMap);
    // input cost: 200K/1M * 0.30 = $0.06
    // input cost original: 1M/1M * 0.30 = $0.30
    // output cost: 500K/1M * 1.20 = $0.60
    // total: $0.06 + $0.60 = $0.66
    // total original: $0.30 + $0.60 = $0.90
    // saved: $0.24
    expect(r.costTotal).toBeCloseTo(0.66, 4);
    expect(r.costTotalOriginal).toBeCloseTo(0.90, 4);
    expect(r.costSaved).toBeCloseTo(0.24, 4);
    expect(r.modelsWithPricing).toBe(1);
  });

  test('free models have $0 cost', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'free-model', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1_000_000, compressedInputTokens: 500_000, ratio: 0.5, method: 'truncate' },
      { ts: 3, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 500_000, totalOriginalInputTokens: 1_000_000, totalOutputTokens: 200_000 },
    ];
    const r = aggregateOverall(events, pricingMap);
    expect(r.costTotal).toBe(0);
    expect(r.costTotalOriginal).toBe(0);
    expect(r.costSaved).toBe(0);
    expect(r.modelsWithPricing).toBe(1);
  });

  test('unknown models (no pricing) skip cost', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'unknown-model', mode: 'light' },
      { ts: 2, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50 },
    ];
    const r = aggregateOverall(events, pricingMap);
    expect(r.costTotal).toBe(0);
    expect(r.modelsWithPricing).toBe(0);
  });

  test('per-model pricing is set on byModel entries', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 200, totalOriginalInputTokens: 1000, totalOutputTokens: 500 },
    ];
    const r = aggregateOverall(events, pricingMap);
    const m3 = r.byModel.find(m => m.model === 'minimax-m3');
    expect(m3?.pricing).toBeDefined();
    expect(m3?.pricing?.inputPerMTok).toBe(0.30);
  });
});

describe('aggregateBySession defensive handling', () => {
  test('old session.end (no totals) does not destroy running sum', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      {
        ts: 3,
        type: 'session.end',
        sessionId: 's1',
        durationMs: 5000,
        totalInputTokens: undefined as unknown as number,
        totalOriginalInputTokens: undefined as unknown as number,
        totalOutputTokens: undefined as unknown as number,
      },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.totalInputTokens).toBe(200);
    expect(r.totalOriginalInputTokens).toBe(1000);
    expect(r.totalSaved).toBe(800);
  });

  test('new session.end with totals takes output tokens but not input', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'session.end', sessionId: 's1', durationMs: 5000, totalInputTokens: 999, totalOriginalInputTokens: 888, totalOutputTokens: 500 },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.totalInputTokens).toBe(200);
    expect(r.totalOriginalInputTokens).toBe(1000);
    expect(r.totalOutputTokens).toBe(500);
  });
});

describe('aggregateBySession with duplicate session.start', () => {
  test('duplicate session.start does not reset running totals', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'L1', sessionId: 's1', tool: 'bash', inputTokens: 500, compressedInputTokens: 100, ratio: 0.8, method: 'truncate' },
      { ts: 4, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'medium' },
      { ts: 5, type: 'L1', sessionId: 's1', tool: 'grep', inputTokens: 300, compressedInputTokens: 50, ratio: 0.83, method: 'truncate' },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.totalOriginalInputTokens).toBe(1800);
    expect(r.totalInputTokens).toBe(350);
    expect(r.totalSaved).toBe(1450);
    expect(r.totalSessions).toBe(1);
  });

  test('orphan L1 events (no session.start) auto-create session', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 2, type: 'session.start', sessionId: 's2', model: 'm', mode: 'light' },
      { ts: 3, type: 'L1', sessionId: 's2', tool: 'read', inputTokens: 500, compressedInputTokens: 100, ratio: 0.8, method: 'truncate' },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.totalSessions).toBe(2);
    expect(r.totalOriginalInputTokens).toBe(1500);
    expect(r.totalInputTokens).toBe(300);
    expect(r.totalSaved).toBe(1200);
  });
});

describe('aggregateOverall with actualCost (v0.3.5)', () => {
  test('tracks actualCost from session.end', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'minimax-m3', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 200, totalOriginalInputTokens: 1000, totalOutputTokens: 500, actualCost: 0.001234 },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.actualCost).toBeCloseTo(0.001234);
    expect(r.sessionsWithActualCost).toBe(1);
  });

  test('sessions without actualCost are 0', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' },
      { ts: 2, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50 },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.actualCost).toBe(0);
    expect(r.sessionsWithActualCost).toBe(0);
  });

  test('sums actualCost across multiple sessions', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm1', mode: 'light' },
      { ts: 2, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50, actualCost: 0.001 },
      { ts: 3, type: 'session.start', sessionId: 's2', model: 'm2', mode: 'light' },
      { ts: 4, type: 'session.end', sessionId: 's2', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50, actualCost: 0.0025 },
      { ts: 5, type: 'session.start', sessionId: 's3', model: 'm3', mode: 'light' },
      { ts: 6, type: 'session.end', sessionId: 's3', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50, actualCost: 0.0005 },
    ];
    const r = aggregateOverall(events, new Map());
    expect(r.actualCost).toBeCloseTo(0.0035);
    expect(r.sessionsWithActualCost).toBe(3);
  });

  test('byModel aggregates actualCost per model', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm1', mode: 'light' },
      { ts: 2, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50, actualCost: 0.001 },
      { ts: 3, type: 'session.start', sessionId: 's2', model: 'm1', mode: 'light' },
      { ts: 4, type: 'session.end', sessionId: 's2', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50, actualCost: 0.002 },
      { ts: 5, type: 'session.start', sessionId: 's3', model: 'm2', mode: 'light' },
      { ts: 6, type: 'session.end', sessionId: 's3', durationMs: 1000, totalInputTokens: 100, totalOriginalInputTokens: 200, totalOutputTokens: 50, actualCost: 0.003 },
    ];
    const r = aggregateOverall(events, new Map());
    const m1 = r.byModel.find(m => m.model === 'm1');
    const m2 = r.byModel.find(m => m.model === 'm2');
    expect(m1?.actualCost).toBeCloseTo(0.003);
    expect(m2?.actualCost).toBeCloseTo(0.003);
  });
});

describe('aggregateBySession with actualCost', () => {
  test('session.end stores actualCost on session', () => {
    const events: StatsEvent[] = [
      { ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' },
      { ts: 2, type: 'L1', sessionId: 's1', tool: 'read', inputTokens: 1000, compressedInputTokens: 200, ratio: 0.8, method: 'truncate' },
      { ts: 3, type: 'session.end', sessionId: 's1', durationMs: 1000, totalInputTokens: 200, totalOriginalInputTokens: 1000, totalOutputTokens: 500, actualCost: 0.0042 },
    ];
    const sessions = aggregateBySession(events, new Map());
    const s = sessions.get('s1');
    expect(s).toBeDefined();
    expect(s?.actualCost).toBeCloseTo(0.0042);
  });
});
