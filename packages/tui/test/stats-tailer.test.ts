import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'fs';
import { join } from 'path';
import { StatsTailer } from '../src/lib/stats-tailer.js';

describe('StatsTailer', () => {
  test('emits events for new lines appended', async () => {
    const tmp = mkdtempSync(join('/tmp', 'st-'));
    const path = join(tmp, 's.jsonl');
    try {
      writeFileSync(path, '');
      const tailer = new StatsTailer(path);
      const received: unknown[] = [];
      tailer.on('event', (e) => received.push(e));
      await tailer.start();

      appendFileSync(path, '{"ts":1,"type":"session.start","sessionId":"s","model":"m","mode":"light"}\n');
      await new Promise((r) => setTimeout(r, 800));
      tailer.stop();
      expect(received.length).toBeGreaterThanOrEqual(1);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});
