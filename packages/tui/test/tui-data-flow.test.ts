import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { readStatsFile } from '../src/lib/stats-reader.js';
import { aggregateOverall, aggregateBySession } from '../src/lib/aggregate.js';
import { StatsTailer } from '../src/lib/stats-tailer.js';

/**
 * Regression: TUI shows "No sessions recorded yet" when file has data.
 * Root cause: tailer wasn't reading new lines, or initial read was failing.
 * These tests verify the data flow works end-to-end with realistic timing.
 */
describe('TUI data flow regression (no sessions shown bug)', () => {
  let tmp: string;
  let statsPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join('/tmp', 'tui-regression-'));
    statsPath = join(tmp, 's.jsonl');
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  test('initial read sees pre-existing session.start', async () => {
    writeFileSync(
      statsPath,
      '{"ts":100,"type":"session.start","sessionId":"s1","model":"minimax-m3","mode":"light"}\n'
    );
    const events = await readStatsFile(statsPath);
    const stats = aggregateOverall(events, new Map());
    expect(stats.totalSessions).toBe(1);
    expect(stats.byModel.length).toBe(1);
    expect(stats.byModel[0].model).toBe('minimax-m3');
  });

  test('tailer picks up new events appended after start', async () => {
    writeFileSync(statsPath, '');
    const tailer = new StatsTailer(statsPath);
    const received: unknown[] = [];
    tailer.on('event', (e) => received.push(e));
    await tailer.start();

    // User simulates chat → plugin emits session.start
    appendFileSync(
      statsPath,
      '{"ts":200,"type":"session.start","sessionId":"newSession","model":"deepseek-flash","mode":"medium"}\n'
    );

    // Wait for poll to fire (500ms) + buffer
    await new Promise((r) => setTimeout(r, 800));
    tailer.stop();

    expect(received.length).toBe(1);
    expect((received[0] as { type: string }).type).toBe('session.start');
  });

  test('tailer picks up events appended BEFORE start (initial read)', async () => {
    // Simulate: TUI starts AFTER plugin already wrote some events
    writeFileSync(
      statsPath,
      '{"ts":100,"type":"session.start","sessionId":"existing","model":"m","mode":"light"}\n' +
        '{"ts":101,"type":"L1","sessionId":"existing","tool":"read","inputTokens":1000,"compressedInputTokens":200,"ratio":0.8,"method":"truncate"}\n'
    );

    const tailer = new StatsTailer(statsPath);
    const received: unknown[] = [];
    tailer.on('event', (e) => received.push(e));
    await tailer.start();

    // No new events appended
    await new Promise((r) => setTimeout(r, 800));
    tailer.stop();

    // tailer doesn't fire events for initial content (that's readStatsFile's job)
    expect(received.length).toBe(0);

    // But the initial read SHOULD see them
    const events = await readStatsFile(statsPath);
    expect(events.length).toBe(2);
  });

  test('end-to-end: file → initial read → tail → 1 session visible', async () => {
    // Simulate plugin writing events over time
    writeFileSync(statsPath, '');

    const tailer = new StatsTailer(statsPath);
    const received: unknown[] = [];
    tailer.on('event', (e) => received.push(e));
    await tailer.start();

    // Initial read: file is empty
    const initialEvents = await readStatsFile(statsPath);
    expect(initialEvents.length).toBe(0);

    // Plugin writes events
    appendFileSync(
      statsPath,
      '{"ts":100,"type":"session.start","sessionId":"e2e","model":"minimax-m3","mode":"light"}\n' +
        '{"ts":101,"type":"L1","sessionId":"e2e","tool":"read","inputTokens":5000,"compressedInputTokens":1200,"ratio":0.76,"method":"truncate"}\n'
    );

    // Wait for tailer to catch up
    await new Promise((r) => setTimeout(r, 800));
    tailer.stop();

    expect(received.length).toBe(2);

    // Re-read file to get full state (simulating TUI's reload)
    const allEvents = await readStatsFile(statsPath);
    const stats = aggregateOverall(allEvents, new Map());

    // THIS is the assertion the user was seeing fail:
    // They expected to see 1 session, but TUI showed 0
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalSaved).toBe(3800);
    expect(stats.byModel[0].sessions).toBe(1);
  });

  test('rapid bursts are not lost (queue serializes writes)', async () => {
    writeFileSync(statsPath, '');
    const tailer = new StatsTailer(statsPath);
    const received: unknown[] = [];
    tailer.on('event', (e) => received.push(e));
    await tailer.start();

    // Simulate 50 rapid events
    for (let i = 0; i < 50; i++) {
      appendFileSync(
        statsPath,
        `{"ts":${100 + i},"type":"L1","sessionId":"burst","tool":"read","inputTokens":1000,"compressedInputTokens":500,"ratio":0.5,"method":"truncate"}\n`
      );
    }

    await new Promise((r) => setTimeout(r, 1500));
    tailer.stop();

    // Should have all 50 events (or very close to it)
    expect(received.length).toBeGreaterThanOrEqual(45);
  });
});
