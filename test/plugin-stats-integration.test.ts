import { describe, test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { StatsEmitter } from '../src/stats-emitter';

describe('Plugin stats emitter end-to-end', () => {
  test('writes realistic event sequence to file', async () => {
    const tmp = mkdtempSync(join('/tmp', 'plugin-stats-'));
    const path = join(tmp, 'stats.jsonl');
    try {
      const emitter = new StatsEmitter({ enabled: true, path: path, rotateMonthly: false });

      // Simulate a realistic plugin lifecycle
      emitter.emit({ ts: 1, type: 'session.start', sessionId: 'real1', model: 'minimax-m3', mode: 'light' });
      emitter.emit({ ts: 2, type: 'L1', sessionId: 'real1', tool: 'read', orig: 5000, comp: 1200, ratio: 0.76, method: 'truncate' });
      emitter.emit({ ts: 3, type: 'L1', sessionId: 'real1', tool: 'bash', orig: 200, comp: 150, ratio: 0.25, method: 'truncate' });
      emitter.emit({ ts: 4, type: 'L2', sessionId: 'real1', file: 'src/foo.ts', orig: 3000, comp: 2700, ratio: 0.1 });
      emitter.emit({ ts: 5, type: 'session.end', sessionId: 'real1', durationMs: 120000 });

      // Wait for async writes
      await new Promise((r) => setTimeout(r, 300));

      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n').filter(l => l);
      expect(lines.length).toBe(5);

      // Verify each line is valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
