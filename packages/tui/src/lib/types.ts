export type StatsEvent =
  | { ts: number; type: 'session.start'; sessionId: string; model: string; mode: string }
  | { ts: number; type: 'session.end'; sessionId: string; durationMs: number }
  | { ts: number; type: 'L1'; sessionId: string; tool: string; orig: number; comp: number; ratio: number; method: 'none' | 'truncate' }
  | { ts: number; type: 'L2'; sessionId: string; file: string; orig: number; comp: number; ratio: number }
  | { ts: number; type: 'L3'; sessionId: string; orig: number; comp: number; ratio: number; verified: boolean }
  | { ts: number; type: 'error'; sessionId: string; layer: string; message: string };

export interface SessionStats {
  sessionId: string;
  model: string;
  mode: string;
  startTs: number;
  endTs?: number;
  durationMs?: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l1Saved: number;
  l2Saved: number;
  l3Saved: number;
  totalSaved: number;
  totalOrig: number;
  errorCount: number;
}

export interface ModelStats {
  model: string;
  sessions: number;
  totalOrig: number;
  totalSaved: number;
  avgRatio: number;
}

export interface ModeStats {
  mode: string;
  sessions: number;
}

export interface LayerStats {
  layer: 'L1' | 'L2' | 'L3';
  count: number;
  totalOrig: number;
  totalSaved: number;
  avgRatio: number;
}

export interface OverallStats {
  totalSessions: number;
  totalEvents: number;
  totalOrig: number;
  totalSaved: number;
  avgRatio: number;
  byModel: ModelStats[];
  byMode: ModeStats[];
  byLayer: LayerStats[];
}
