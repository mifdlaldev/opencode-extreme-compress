import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Logger, setLogLevel, getLogLevel } from '../src/utils/logger';

describe('logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleError: typeof console.error;
  let captured: { log: string[]; warn: string[]; error: string[] };

  beforeEach(() => {
    captured = { log: [], warn: [], error: [] };
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    console.log = (msg: string) => captured.log.push(msg);
    console.warn = (msg: string) => captured.warn.push(msg);
    console.error = (msg: string) => captured.error.push(msg);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    setLogLevel('info'); // reset to default
  });

  test('info messages include prefix and message', () => {
    setLogLevel('info');
    Logger.info('test message');
    expect(captured.log.length).toBe(1);
    expect(captured.log[0]).toContain('[EXTREME-COMPRESS]');
    expect(captured.log[0]).toContain('test message');
  });

  test('debug suppressed in info mode', () => {
    setLogLevel('info');
    Logger.debug('debug message');
    expect(captured.log.length).toBe(0);
  });

  test('debug shown in debug mode', () => {
    setLogLevel('debug');
    Logger.debug('debug message');
    expect(captured.log.length).toBe(1);
  });

  test('warn shown in info mode', () => {
    setLogLevel('info');
    Logger.warn('warn message');
    expect(captured.warn.length).toBe(1);
    expect(captured.warn[0]).toContain('[EXTREME-COMPRESS WARN]');
  });

  test('error always shown', () => {
    setLogLevel('silent');
    Logger.error('error message');
    expect(captured.error.length).toBe(1);
    expect(captured.error[0]).toContain('error message');
  });

  test('silent suppresses everything except error', () => {
    setLogLevel('silent');
    Logger.debug('d');
    Logger.info('i');
    Logger.warn('w');
    Logger.error('e');
    expect(captured.log.length).toBe(0);
    expect(captured.warn.length).toBe(0);
    expect(captured.error.length).toBe(1);
  });

  test('getLogLevel returns current level', () => {
    setLogLevel('warn');
    expect(getLogLevel()).toBe('warn');
  });

  test('Logger.info accepts additional args (forwarded)', () => {
    setLogLevel('info');
    Logger.info('with args', 'arg1', 42);
    expect(captured.log.length).toBe(1);
    // Args are forwarded to console
  });
});
