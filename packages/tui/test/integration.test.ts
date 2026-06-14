import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { readStatsFile } from '../src/lib/stats-reader.js';
import { aggregateOverall } from '../src/lib/aggregate.js';

describe('TUI end-to-end with realistic stats (v0.3.0 schema)', () => {
  test('reads file → aggregates → produces correct view data with input/output tokens', async () => {
    const tmp = mkdtempSync(join('/tmp', 'tui-e2e-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path,
        '{"ts":1,"type":"session.start","sessionId":"s1","model":"minimax-m3","mode":"light"}\n' +
        '{"ts":2,"type":"L1","sessionId":"s1","tool":"read","inputTokens":1000,"compressedInputTokens":200,"ratio":0.8,"method":"truncate"}\n' +
        '{"ts":3,"type":"L2","sessionId":"s1","file":"src/foo.ts","inputTokens":500,"compressedInputTokens":400,"ratio":0.2}\n' +
        '{"ts":4,"type":"session.end","sessionId":"s1","durationMs":60000,"totalInputTokens":600,"totalOriginalInputTokens":1500,"totalOutputTokens":300}\n' +
        '{"ts":10,"type":"session.start","sessionId":"s2","model":"deepseek-flash","mode":"medium"}\n' +
        '{"ts":11,"type":"L3","sessionId":"s2","inputTokens":5000,"compressedInputTokens":1000,"ratio":0.8,"verified":true}\n' +
        '{"ts":12,"type":"session.end","sessionId":"s2","durationMs":120000,"totalInputTokens":1000,"totalOriginalInputTokens":5000,"totalOutputTokens":200}\n'
      );

      const events = await readStatsFile(path);
      const stats = aggregateOverall(events, new Map());

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalOriginalInputTokens).toBe(6500);
      expect(stats.totalInputTokens).toBe(1600);
      expect(stats.totalOutputTokens).toBe(500);
      expect(stats.totalSaved).toBe(4900);
      expect(stats.avgRatio).toBeCloseTo(0.7538, 3);
      expect(stats.byModel.length).toBe(2);
      expect(stats.byLayer.length).toBe(3);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('handles empty stats file gracefully', async () => {
    const tmp = mkdtempSync(join('/tmp', 'tui-e2e-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path, '');
      const events = await readStatsFile(path);
      const stats = aggregateOverall(events, new Map());
      expect(events).toEqual([]);
      expect(stats.totalSessions).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('handles stats file with old session.end (no totals) + L1 events', async () => {
    const tmp = mkdtempSync(join('/tmp', 'tui-e2e-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path,
        '{"ts":1,"type":"session.start","sessionId":"s1","model":"minimax-m3","mode":"light"}\n' +
        '{"ts":2,"type":"L1","sessionId":"s1","tool":"read","orig":1000,"comp":200,"ratio":0.8,"method":"truncate"}\n' +
        '{"ts":3,"type":"session.end","sessionId":"s1","durationMs":5000}\n' +
        '{"ts":4,"type":"session.start","sessionId":"s2","model":"kimi-k2.6","mode":"medium"}\n' +
        '{"ts":5,"type":"L1","sessionId":"s2","tool":"read","inputTokens":500,"compressedInputTokens":100,"ratio":0.8,"method":"truncate"}\n'
      );

      const events = await readStatsFile(path);
      const stats = aggregateOverall(events, new Map());
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalOriginalInputTokens).toBe(1500);
      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalSaved).toBe(1200);
      const l1Layer = stats.byLayer.find(l => l.layer === 'L1');
      expect(l1Layer?.totalSaved).toBe(1200);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
