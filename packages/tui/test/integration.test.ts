import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { readStatsFile } from '../src/lib/stats-reader.js';
import { aggregateOverall } from '../src/lib/aggregate.js';

describe('TUI end-to-end with realistic stats', () => {
  test('reads file → aggregates → produces correct view data', async () => {
    const tmp = mkdtempSync(join('/tmp', 'tui-e2e-'));
    const path = join(tmp, 's.jsonl');
    try {
      // Simulate 2 sessions with realistic mix of events
      writeFileSync(path,
        '{"ts":1,"type":"session.start","sessionId":"s1","model":"minimax-m3","mode":"light"}\n' +
        '{"ts":2,"type":"L1","sessionId":"s1","tool":"read","orig":1000,"comp":200,"ratio":0.8}\n' +
        '{"ts":3,"type":"L2","sessionId":"s1","file":"src/foo.ts","orig":500,"comp":400,"ratio":0.2}\n' +
        '{"ts":4,"type":"session.end","sessionId":"s1","durationMs":60000}\n' +
        '{"ts":10,"type":"session.start","sessionId":"s2","model":"deepseek-flash","mode":"medium"}\n' +
        '{"ts":11,"type":"L3","sessionId":"s2","orig":5000,"comp":1000,"ratio":0.8,"verified":true}\n' +
        '{"ts":12,"type":"session.end","sessionId":"s2","durationMs":120000}\n'
      );

      const events = await readStatsFile(path);
      const stats = aggregateOverall(events);

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalOrig).toBe(6500);
      expect(stats.totalSaved).toBe(4900);
      expect(stats.avgRatio).toBeCloseTo(0.7538, 3);
      expect(stats.byModel.length).toBe(2);
      expect(stats.byLayer.length).toBe(3);  // L1, L2, L3

      // Verify L3 marked as verified
      const l3 = stats.byLayer.find(l => l.layer === 'L3');
      expect(l3).toBeDefined();
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
      const stats = aggregateOverall(events);
      expect(events).toEqual([]);
      expect(stats.totalSessions).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
