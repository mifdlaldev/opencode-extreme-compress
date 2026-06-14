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

      emitter.emit({ ts: 1, type: 'session.start', sessionId: 'real1', model: 'minimax-m3', mode: 'light' });
      emitter.emit({ ts: 2, type: 'L1', sessionId: 'real1', tool: 'read', inputTokens: 5000, compressedInputTokens: 1200, ratio: 0.76, method: 'truncate' });
      emitter.emit({ ts: 3, type: 'L1', sessionId: 'real1', tool: 'bash', inputTokens: 200, compressedInputTokens: 150, ratio: 0.25, method: 'truncate' });
      emitter.emit({ ts: 4, type: 'L2', sessionId: 'real1', file: 'src/foo.ts', inputTokens: 3000, compressedInputTokens: 2700, ratio: 0.1 });
      emitter.emit({
        ts: 5,
        type: 'session.end',
        sessionId: 'real1',
        durationMs: 120000,
        totalInputTokens: 4050,
        totalOriginalInputTokens: 8200,
        totalOutputTokens: 1500,
      });

      await new Promise((r) => setTimeout(r, 300));

      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n').filter(l => l);
      expect(lines.length).toBe(5);

      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
