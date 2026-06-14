export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

let currentLevel: LogLevel = 'warn';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 3,
};

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function stderrLine(prefix: string, msg: string, args: unknown[]): void {
  let line = `${prefix} ${msg}`;
  if (args.length > 0) {
    line += ' ' + args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');
  }
  process.stderr.write(line + '\n');
}

export const Logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.debug) {
      stderrLine('[EXTREME-COMPRESS DEBUG]', msg, args);
    }
  },
  info(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.info) {
      stderrLine('[EXTREME-COMPRESS INFO]', msg, args);
    }
  },
  warn(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.warn) {
      stderrLine('[EXTREME-COMPRESS WARN]', msg, args);
    }
  },
  error(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.error) {
      stderrLine('[EXTREME-COMPRESS ERROR]', msg, args);
    }
  },
};
