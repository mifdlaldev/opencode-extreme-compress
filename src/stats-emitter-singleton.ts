import { StatsEmitter } from './stats-emitter';

let emitter: StatsEmitter | null = null;

export function setStatsEmitter(e: StatsEmitter): void {
  emitter = e;
}

export function getStatsEmitter(): StatsEmitter | null {
  return emitter;
}
