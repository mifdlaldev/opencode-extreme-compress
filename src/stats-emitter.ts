import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { StatsConfig } from './types';

export type StatsEvent =
  | { ts: number; type: 'session.start'; sessionId: string; model: string; mode: string }
  | { ts: number; type: 'session.end'; sessionId: string; durationMs: number; totalInputTokens: number; totalOriginalInputTokens: number; totalOutputTokens: number }
  | { ts: number; type: 'L1'; sessionId: string; tool: string; inputTokens: number; compressedInputTokens: number; ratio: number; method: 'none' | 'truncate' }
  | { ts: number; type: 'L2'; sessionId: string; file: string; inputTokens: number; compressedInputTokens: number; ratio: number }
  | { ts: number; type: 'L3'; sessionId: string; inputTokens: number; compressedInputTokens: number; ratio: number; verified: boolean }
  | { ts: number; type: 'error'; sessionId: string; layer: string; message: string };

export class StatsEmitter {
  private config: StatsConfig;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: StatsConfig) {
    this.config = config;
  }

  emit(event: StatsEvent): void {
    if (!this.config.enabled) return;
    const line = JSON.stringify(event) + '\n';
    this.writeQueue = this.writeQueue.then(() => this.write(line)).catch(() => {});
  }

  private async write(line: string): Promise<void> {
    const path = this.resolvePath();
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, line, 'utf-8');
  }

  private resolvePath(): string {
    return this.config.path.replace(/^~/, process.env.HOME ?? '');
  }
}
