import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createEventHook } from '../src/hooks/event-hook';
import { setSessionState, clearSessionState } from '../src/hooks/tool-execute-after';
import { setSessionTurnState, clearSessionTurnState, getMessageCost, clearMessageCost } from '../src/hooks/chat-message';
import { StatsEmitter } from '../src/stats-emitter';
import { setStatsEmitter } from '../src/stats-emitter-singleton';

describe('event-hook: v0.3.5 real info.tokens/info.cost', () => {
  let tmpDir: string;
  let statsPath: string;
  let sessionStartTimes: Map<string, number>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join('/tmp', 'event-hook-'));
    statsPath = join(tmpDir, 'stats.jsonl');
    setStatsEmitter(new StatsEmitter({ enabled: true, path: statsPath, rotateMonthly: false }));
    sessionStartTimes = new Map();
  });

  afterEach(() => {
    clearSessionState('s1');
    clearSessionTurnState('s1');
    clearMessageCost('s1');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('message.updated reads info.tokens.output and adds to totalOutputTokens', async () => {
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
      sessionStartTimes
    );

    await hook({
      event: {
        type: 'message.updated',
        properties: {
          info: {
            id: 'msg-1',
            sessionID: 's1',
            role: 'assistant',
            cost: 0.001234,
            tokens: {
              input: 100,
              output: 250,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
          },
        },
      },
    });

    const { getSessionTotals } = await import('../src/hooks/chat-message');
    const t = getSessionTotals('s1');
    expect(t?.totalOutputTokens).toBe(250);
    expect(getMessageCost('s1')).toBeCloseTo(0.001234);
  });

  test('message.updated dedupes repeated events for same message id', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 0, totalOriginalInputTokens: 0, totalOutputTokens: 0,
    });

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes
    );

    const props = {
      info: {
        id: 'msg-dup',
        sessionID: 's1',
        role: 'assistant',
        cost: 0.0005,
        tokens: {
          input: 0,
          output: 100,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
      },
    };
    await hook({ event: { type: 'message.updated', properties: props } });
    await hook({ event: { type: 'message.updated', properties: props } });
    await hook({ event: { type: 'message.updated', properties: props } });

    const { getSessionTotals } = await import('../src/hooks/chat-message');
    const t = getSessionTotals('s1');
    expect(t?.totalOutputTokens).toBe(100);
    expect(getMessageCost('s1')).toBeCloseTo(0.0005);
  });

  test('message.updated ignores non-assistant roles', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 0, totalOriginalInputTokens: 0, totalOutputTokens: 0,
    });

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes
    );

    await hook({
      event: {
        type: 'message.updated',
        properties: {
          info: {
            id: 'user-msg',
            sessionID: 's1',
            role: 'user',
            tokens: { input: 50, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          },
        },
      },
    });

    const { getSessionTotals } = await import('../src/hooks/chat-message');
    const t = getSessionTotals('s1');
    expect(t?.totalOutputTokens).toBe(0);
  });

  test('session.idle emits session.end with actualCost', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 200, totalOriginalInputTokens: 1000, totalOutputTokens: 500,
    });
    sessionStartTimes.set('s1', Date.now() / 1000 - 10);
    // Pre-set message cost
    const { addMessageCost } = await import('../src/hooks/chat-message');
    addMessageCost('s1', 0.005678);

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes
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
    expect(sessionEnd.actualCost).toBeCloseTo(0.005678);
  });

  test('session.status with status.type=idle emits session.end with actualCost', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 100, totalOriginalInputTokens: 500, totalOutputTokens: 250,
    });
    sessionStartTimes.set('s1', Date.now() / 1000 - 5);
    const { addMessageCost } = await import('../src/hooks/chat-message');
    addMessageCost('s1', 0.002);

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes
    );

    await hook({
      event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'idle' } } },
    });

    await new Promise((r) => setTimeout(r, 100));
    const content = readFileSync(statsPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const sessionEnd = lines
      .map((l) => JSON.parse(l))
      .find((e: { type: string }) => e.type === 'session.end');
    expect(sessionEnd).toBeDefined();
    expect(sessionEnd.actualCost).toBeCloseTo(0.002);
  });

  test('session.status with status.type=busy does NOT emit session.end', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 100, totalOriginalInputTokens: 500, totalOutputTokens: 250,
    });
    sessionStartTimes.set('s1', Date.now() / 1000 - 5);

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes
    );

    await hook({
      event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } },
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

  test('session.deleted emits session.end and cleans up state', async () => {
    setSessionState('s1', { config: {} as never, mode: 'light' });
    setSessionTurnState('s1', {
      config: {} as never, mode: 'light', turnCount: 0,
      totalInputTokens: 100, totalOriginalInputTokens: 500, totalOutputTokens: 250,
    });
    sessionStartTimes.set('s1', Date.now() / 1000 - 5);
    const { addMessageCost } = await import('../src/hooks/chat-message');
    addMessageCost('s1', 0.003);

    const hook = createEventHook(
      () => ({ config: {} as never, mode: 'light' }),
      sessionStartTimes
    );

    await hook({
      event: { type: 'session.deleted', properties: { sessionID: 's1' } },
    });

    await new Promise((r) => setTimeout(r, 100));
    const content = readFileSync(statsPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const sessionEnd = lines
      .map((l) => JSON.parse(l))
      .find((e: { type: string }) => e.type === 'session.end');
    expect(sessionEnd).toBeDefined();
    expect(sessionEnd.actualCost).toBeCloseTo(0.003);

    // State cleaned up
    expect(getMessageCost('s1')).toBe(0);
  });

  test('session.idle does NOT emit when session is unknown', async () => {
    const hook = createEventHook(
      () => undefined,
      sessionStartTimes
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
