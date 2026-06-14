import { watch, type FSWatcher } from 'fs';
import { stat, open } from 'fs/promises';
import { EventEmitter } from 'events';
import type { StatsEvent } from './types.js';

export class StatsTailer extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSize = 0;
  private path: string;

  constructor(path: string) {
    super();
    this.path = path;
  }

  async start(): Promise<void> {
    try {
      const stats = await stat(this.path);
      this.lastSize = stats.size;
    } catch {
      this.lastSize = 0;
    }

    try {
      this.watcher = watch(this.path, () => { void this.readNewLines(); });
    } catch {
      this.watcher = null;
    }

    this.pollTimer = setInterval(() => { void this.readNewLines(); }, 500);
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async readNewLines(): Promise<void> {
    try {
      const stats = await stat(this.path);
      if (stats.size < this.lastSize) this.lastSize = 0;
      if (stats.size <= this.lastSize) return;

      const fh = await open(this.path, 'r');
      try {
        const buf = Buffer.alloc(stats.size - this.lastSize);
        await fh.read(buf, 0, buf.length, this.lastSize);
        this.lastSize = stats.size;
        const newContent = buf.toString('utf-8');
        for (const line of newContent.split('\n')) {
          if (!line.trim()) continue;
          try {
            this.emit('event', JSON.parse(line) as StatsEvent);
          } catch {
            // skip malformed
          }
        }
      } finally {
        await fh.close();
      }
    } catch {
      // file may not exist yet
    }
  }
}
