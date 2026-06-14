import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { readStatsFile } from '../src/lib/stats-reader.js';

describe('readStatsFile', () => {
  test('parses valid JSONL', async () => {
    const tmp = mkdtempSync(join('/tmp', 'sr-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path, '{"ts":1,"type":"session.start","sessionId":"s1","model":"m","mode":"light"}\n{"ts":2,"type":"L1","sessionId":"s1","tool":"read","orig":100,"comp":50,"ratio":0.5}\n');
      const events = await readStatsFile(path);
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('session.start');
      expect(events[1].type).toBe('L1');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  test('skips malformed lines', async () => {
    const tmp = mkdtempSync(join('/tmp', 'sr-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path, '{"ts":1,"type":"session.start","sessionId":"s1","model":"m","mode":"light"}\nNOT JSON\n{"ts":2,"type":"L1","sessionId":"s1","tool":"read","orig":100,"comp":50,"ratio":0.5}\n');
      const events = await readStatsFile(path);
      expect(events.length).toBe(2);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  test('returns empty for missing file', async () => {
    const events = await readStatsFile('/nonexistent/path.jsonl');
    expect(events).toEqual([]);
  });

  test('handles empty file', async () => {
    const tmp = mkdtempSync(join('/tmp', 'sr-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path, '');
      const events = await readStatsFile(path);
      expect(events).toEqual([]);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});
