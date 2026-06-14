import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Logger, setLogLevel, getLogLevel } from '../src/utils/logger';

describe('logger', () => {
  let originalStderrWrite: typeof process.stderr.write;
  let captured: string[];

  beforeEach(() => {
    captured = [];
    originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      captured.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
    setLogLevel('warn'); // reset to default
  });

  test('default level is warn (info/debug suppressed)', () => {
    expect(getLogLevel()).toBe('warn');
    Logger.info('should not appear');
    Logger.debug('should not appear either');
    expect(captured.length).toBe(0);
  });

  test('info messages include prefix and message when level allows', () => {
    setLogLevel('info');
    Logger.info('test message');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[EXTREME-COMPRESS INFO]');
    expect(captured[0]).toContain('test message');
  });

  test('debug messages shown in debug mode', () => {
    setLogLevel('debug');
    Logger.debug('debug message');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[EXTREME-COMPRESS DEBUG]');
  });

  test('debug suppressed in info mode', () => {
    setLogLevel('info');
    Logger.debug('debug message');
    expect(captured.length).toBe(0);
  });

  test('debug suppressed in warn mode (default)', () => {
    setLogLevel('warn');
    Logger.debug('debug message');
    Logger.info('info message');
    expect(captured.length).toBe(0);
  });

  test('warn shown in warn mode (default)', () => {
    Logger.warn('warn message');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[EXTREME-COMPRESS WARN]');
    expect(captured[0]).toContain('warn message');
  });

  test('error always shown even in silent mode', () => {
    setLogLevel('silent');
    Logger.error('error message');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('[EXTREME-COMPRESS ERROR]');
  });

  test('silent suppresses everything except error', () => {
    setLogLevel('silent');
    Logger.debug('d');
    Logger.info('i');
    Logger.warn('w');
    Logger.error('e');
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('e');
  });

  test('writes to STDERR not STDOUT (UX: does not pollute TUI input)', () => {
    // Capture stdout separately to confirm nothing leaks there
    let stdoutCaptured = '';
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutCaptured += typeof chunk === 'string' ? chunk : chunk.toString();
      return true;
    }) as typeof process.stdout.write;

    try {
      setLogLevel('debug');
      Logger.debug('test');
      Logger.info('test');
      Logger.warn('test');
      Logger.error('test');

      // STDERR should have 4 entries
      expect(captured.length).toBe(4);

      // STDOUT should have NOTHING
      expect(stdoutCaptured).toBe('');
    } finally {
      process.stdout.write = originalStdoutWrite;
    }
  });

  test('Logger.info accepts additional args (forwarded)', () => {
    setLogLevel('info');
    Logger.info('with args', 'arg1', 42);
    expect(captured.length).toBe(1);
    expect(captured[0]).toContain('arg1');
    expect(captured[0]).toContain('42');
  });

  test('getLogLevel returns current level', () => {
    setLogLevel('error');
    expect(getLogLevel()).toBe('error');
  });
});
