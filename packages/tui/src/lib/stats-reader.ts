import { readFile } from 'fs/promises';
import type { StatsEvent } from './types.js';

export async function readStatsFile(path: string): Promise<StatsEvent[]> {
  const content = await readFile(path, 'utf-8').catch(() => '');
  const events: StatsEvent[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as StatsEvent);
    } catch {
      // skip malformed lines gracefully
    }
  }
  return events;
}
