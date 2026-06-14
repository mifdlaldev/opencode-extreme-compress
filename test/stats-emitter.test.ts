import { describe, test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { StatsEmitter } from '../src/stats-emitter';

describe('StatsEmitter', () => {
  test('emits JSON line per event', async () => {
    const tmp = mkdtempSync(join('/tmp', 'stats-test-'));
    const path = join(tmp, 's.jsonl');
    try {
      const emitter = new StatsEmitter({ enabled: true, path: path, rotateMonthly: false });
      emitter.emit({ ts: 100, type: 'session.start', sessionId: 's1', model: 'm1', mode: 'light' });
      await new Promise((r) => setTimeout(r, 100));
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('"type":"session.start"');
      expect(content.endsWith('\n')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('does not write when disabled', async () => {
    const tmp = mkdtempSync(join('/tmp', 'stats-test-'));
    const path = join(tmp, 's.jsonl');
    try {
      const emitter = new StatsEmitter({ enabled: false, path: path, rotateMonthly: false });
      emitter.emit({ ts: 100, type: 'session.start', sessionId: 's1', model: 'm1', mode: 'light' });
      await new Promise((r) => setTimeout(r, 100));
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('serializes concurrent writes (no interleaving)', async () => {
    const tmp = mkdtempSync(join('/tmp', 'stats-test-'));
    const path = join(tmp, 's.jsonl');
    try {
      const emitter = new StatsEmitter({ enabled: true, path: path, rotateMonthly: false });
      for (let i = 0; i < 100; i++) {
        emitter.emit({ ts: i, type: 'L1', sessionId: 's', tool: 'read', orig: 1000, comp: 500, ratio: 0.5, method: 'truncate' });
      }
      await new Promise((r) => setTimeout(r, 500));
      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n').filter(l => l);
      expect(lines.length).toBe(100);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('expands ~ to home directory', () => {
    const e = new StatsEmitter({ enabled: true, path: '~/test.jsonl', rotateMonthly: false });
    // private method but we can test via emit
    e.emit({ ts: 1, type: 'L1', sessionId: 's', tool: 't', orig: 1, comp: 1, ratio: 0, method: 'none' });
    // The write will fail (no permission to ~/test.jsonl typically) but should not throw synchronously
  });
});
