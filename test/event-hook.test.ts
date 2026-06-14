import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createEventHook } from '../src/hooks/event-hook';
import { setSessionState, clearSessionState } from '../src/hooks/tool-execute-after';
import { setSessionTurnState, clearSessionTurnState } from '../src/hooks/chat-message';
import { StatsEmitter } from '../src/stats-emitter';
import { setStatsEmitter } from '../src/stats-emitter-singleton';

describe('event-hook: v0.3.4 bugfixes', () => {
  let tmpDir: string;
  let statsPath: string;
  let sessionStartTimes: Map<string, number>;
  let sessionModels: Map<string, string>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join('/tmp', 'event-hook-'));
    statsPath = join(tmpDir, 'stats.jsonl');
    setStatsEmitter(new StatsEmitter({ enabled: true, path: statsPath, rotateMonthly: false }));
    sessionStartTimes = new Map();
    sessionModels = new Map();
  });

  afterEach(() => {
    clearSessionState('s1');
    clearSessionTurnState('s1');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('message.updated tracks assistant output tokens (BUG #1 fix)', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never,
      mode: 'light',
      turnCount: 0,
      totalInputTokens: 0,
      totalOriginalInputTokens: 0,
      totalOutputTokens: 0,
    });
    sessionStartTimes.set('s1', Date.now() / 1000 - 10);

    const hook = createEventHook(
      (sid) => (sid === 's1' ? { config: {} as never, mode: 'light' } : undefined),
      sessionStartTimes,
      sessionModels
    );

    await hook({
      event: {
        type: 'message.updated',
        properties: {
          sessionID: 's1',
          message: {
            id: 'msg-1',
            sessionID: 's1',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Hello, this is a test response from the LLM.' }],
          },
        },
      },
    });

    const totals = sessionStartTimes.get('s1');
    expect(totals).toBeDefined();
    const { getSessionTotals } = await import('../src/hooks/chat-message');
    const t = getSessionTotals('s1');
    expect(t?.totalOutputTokens).toBeGreaterThan(0);
  });

  test('message.updated dedupes repeated events for same message id', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 0, totalOriginalInputTokens: 0, totalOutputTokens: 0,
    });

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes,
      sessionModels
    );

    const props = {
      sessionID: 's1',
      message: {
        id: 'msg-dup',
        sessionID: 's1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Same message' }],
      },
    };
    await hook({ event: { type: 'message.updated', properties: props } });
    await hook({ event: { type: 'message.updated', properties: props } });
    await hook({ event: { type: 'message.updated', properties: props } });

    const { getSessionTotals } = await import('../src/hooks/chat-message');
    const t = getSessionTotals('s1');
    expect(t?.totalOutputTokens).toBe(3);
  });

  test('session.idle emits session.end with running totals (BUG #2 fix)', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 200, totalOriginalInputTokens: 1000, totalOutputTokens: 500,
    });
    sessionStartTimes.set('s1', Date.now() / 1000 - 5);

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes,
      sessionModels
    );

    await hook({
      event: { type: 'session.idle', properties: { sessionID: 's1' } },
    });

    await new Promise((r) => setTimeout(r, 100));
    const content = readFileSync(statsPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const sessionEnd = lines
      .map((l) => JSON.parse(l))
      .find((e: { type: string }) => e.type === 'session.end');
    expect(sessionEnd).toBeDefined();
    expect(sessionEnd.totalInputTokens).toBe(200);
    expect(sessionEnd.totalOriginalInputTokens).toBe(1000);
    expect(sessionEnd.totalOutputTokens).toBe(500);
  });

  test('session.idle does NOT emit when session is unknown', async () => {
    const hook = createEventHook(
      () => undefined,
      sessionStartTimes,
      sessionModels
    );

    await hook({
      event: { type: 'session.idle', properties: { sessionID: 'unknown' } },
    });

    await new Promise((r) => setTimeout(r, 100));
    let content = '';
    try {
      content = readFileSync(statsPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    expect(content.trim()).toBe('');
  });
});
