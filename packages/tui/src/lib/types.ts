export type StatsEvent =
  | { ts: number; type: 'session.start'; sessionId: string; model: string; mode: string }
  | { ts: number; type: 'session.end'; sessionId: string; durationMs: number; totalInputTokens: number; totalOriginalInputTokens: number; totalOutputTokens: number }
  | { ts: number; type: 'L1'; sessionId: string; tool: string; inputTokens: number; compressedInputTokens: number; ratio: number; method: 'none' | 'truncate' }
  | { ts: number; type: 'L2'; sessionId: string; file: string; inputTokens: number; compressedInputTokens: number; ratio: number }
  | { ts: number; type: 'L3'; sessionId: string; inputTokens: number; compressedInputTokens: number; ratio: number; verified: boolean }
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
  totalOriginalInputTokens: number;  // from L1/L2/L3 sum
  totalInputTokens: number;          // from L1/L2/L3 sum (post-compression)
  totalOutputTokens: number;         // from chat.message estimation
  totalSaved: number;                 // = totalOriginalInputTokens - totalInputTokens
  errorCount: number;
}

export interface ModelStats {
  model: string;
  sessions: number;
  totalInputTokens: number;
  totalOriginalInputTokens: number;
  totalOutputTokens: number;
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
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSaved: number;
  avgRatio: number;
}

export interface OverallStats {
  totalSessions: number;
  totalEvents: number;
  totalInputTokens: number;
  totalOriginalInputTokens: number;
  totalOutputTokens: number;
  totalSaved: number;
  avgRatio: number;
  byModel: ModelStats[];
  byMode: ModeStats[];
  byLayer: LayerStats[];
}
