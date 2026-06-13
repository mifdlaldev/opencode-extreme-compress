export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

let currentLevel: LogLevel = 'info';

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

export const Logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.debug) {
      console.log(`[EXTREME-COMPRESS DEBUG] ${msg}`, ...args);
    }
  },
  info(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.info) {
      console.log(`[EXTREME-COMPRESS] ${msg}`, ...args);
    }
  },
  warn(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.warn) {
      console.warn(`[EXTREME-COMPRESS WARN] ${msg}`, ...args);
    }
  },
  error(msg: string, ...args: unknown[]): void {
    if (LEVEL_PRIORITY[currentLevel] <= LEVEL_PRIORITY.error) {
      console.error(`[EXTREME-COMPRESS ERROR] ${msg}`, ...args);
    }
  },
};
