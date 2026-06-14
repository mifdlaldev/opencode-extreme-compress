import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { StatsEmitter } from '../src/stats-emitter';

describe('StatsEmitter', () => {
  let tmpDir: string;
  let statsPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join('/tmp', 'stats-test-'));
    statsPath = join(tmpDir, 'stats.jsonl');
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  test('emits JSON line per event', () => {
    const emitter = new StatsEmitter({ enabled: true, path: statsPath, rotateMonthly: false });
    emitter.emit({ ts: 100, type: 'session.start', sessionId: 's1', model: 'm1', mode: 'light' });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const content = readFileSync(statsPath, 'utf-8');
        expect(content).toContain('"type":"session.start"');
        expect(content.endsWith('\n')).toBe(true);
        resolve();
      }, 50);
    });
  });

  test('does not write when disabled', () => {
    const emitter = new StatsEmitter({ enabled: false, path: statsPath, rotateMonthly: false });
    emitter.emit({ ts: 100, type: 'session.start', sessionId: 's1', model: 'm1', mode: 'light' });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(existsSync(statsPath)).toBe(false);
        resolve();
      }, 50);
    });
  });

  test('serializes concurrent writes (no interleaving)', () => {
    const emitter = new StatsEmitter({ enabled: true, path: statsPath, rotateMonthly: false });
    for (let i = 0; i < 100; i++) {
      emitter.emit({ ts: i, type: 'L1', sessionId: 's', tool: 'read', inputTokens: 1000, compressedInputTokens: 500, ratio: 0.5, method: 'truncate' });
    }
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const content = readFileSync(statsPath, 'utf-8');
        const lines = content.split('\n').filter(l => l);
        expect(lines.length).toBe(100);
        for (const line of lines) {
          expect(() => JSON.parse(line)).not.toThrow();
        }
        resolve();
      }, 200);
    });
  });

  test('emits session.end with totals', () => {
    const emitter = new StatsEmitter({ enabled: true, path: statsPath, rotateMonthly: false });
    emitter.emit({ ts: 1, type: 'session.start', sessionId: 's1', model: 'm', mode: 'light' });
    emitter.emit({
      ts: 100, type: 'session.end', sessionId: 's1', durationMs: 60000,
      totalInputTokens: 5000, totalOriginalInputTokens: 12000, totalOutputTokens: 800,
    });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const content = readFileSync(statsPath, 'utf-8');
        const lines = content.split('\n').filter(l => l);
        expect(lines.length).toBe(2);
        const sessionEnd = JSON.parse(lines[1]);
        expect(sessionEnd.totalInputTokens).toBe(5000);
        expect(sessionEnd.totalOriginalInputTokens).toBe(12000);
        expect(sessionEnd.totalOutputTokens).toBe(800);
        resolve();
      }, 100);
    });
  });
});
