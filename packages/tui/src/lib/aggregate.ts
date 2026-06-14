import type { StatsEvent, SessionStats, ModelStats, ModeStats, LayerStats, OverallStats } from './types.js';

export function aggregateBySession(events: StatsEvent[]): Map<string, SessionStats> {
  const sessions = new Map<string, SessionStats>();
  for (const ev of events) {
    if (ev.type === 'session.start') {
      sessions.set(ev.sessionId, {
        sessionId: ev.sessionId, model: ev.model, mode: ev.mode, startTs: ev.ts,
        l1Count: 0, l2Count: 0, l3Count: 0,
        totalOriginalInputTokens: 0, totalInputTokens: 0, totalOutputTokens: 0,
        totalSaved: 0, errorCount: 0,
      });
    } else if (ev.type === 'session.end') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.endTs = ev.ts;
        s.durationMs = ev.durationMs;
        s.totalInputTokens = ev.totalInputTokens;
        s.totalOriginalInputTokens = ev.totalOriginalInputTokens;
        s.totalOutputTokens = ev.totalOutputTokens;
        s.totalSaved = ev.totalOriginalInputTokens - ev.totalInputTokens;
      }
    } else if (ev.type === 'L1') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.l1Count++;
        s.totalOriginalInputTokens += ev.inputTokens;
        s.totalInputTokens += ev.compressedInputTokens;
        s.totalSaved += ev.inputTokens - ev.compressedInputTokens;
      }
    } else if (ev.type === 'L2') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.l2Count++;
        s.totalOriginalInputTokens += ev.inputTokens;
        s.totalInputTokens += ev.compressedInputTokens;
        s.totalSaved += ev.inputTokens - ev.compressedInputTokens;
      }
    } else if (ev.type === 'L3') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.l3Count++;
        s.totalOriginalInputTokens += ev.inputTokens;
        s.totalInputTokens += ev.compressedInputTokens;
        s.totalSaved += ev.inputTokens - ev.compressedInputTokens;
      }
    } else if (ev.type === 'error') {
      const s = sessions.get(ev.sessionId);
      if (s) s.errorCount++;
    }
  }
  return sessions;
}

export function aggregateOverall(events: StatsEvent[]): OverallStats {
  const sessions = aggregateBySession(events);
  const allSessions = Array.from(sessions.values());

  const byModelMap = new Map<string, { sessions: number; totalInputTokens: number; totalOriginalInputTokens: number; totalOutputTokens: number; totalSaved: number }>();
  for (const s of allSessions) {
    const m = byModelMap.get(s.model) ?? { sessions: 0, totalInputTokens: 0, totalOriginalInputTokens: 0, totalOutputTokens: 0, totalSaved: 0 };
    m.sessions++;
    m.totalInputTokens += s.totalInputTokens;
    m.totalOriginalInputTokens += s.totalOriginalInputTokens;
    m.totalOutputTokens += s.totalOutputTokens;
    m.totalSaved += s.totalSaved;
    byModelMap.set(s.model, m);
  }
  const byModel: ModelStats[] = Array.from(byModelMap.entries())
    .map(([model, v]) => ({ model, ...v, avgRatio: v.totalOriginalInputTokens > 0 ? v.totalSaved / v.totalOriginalInputTokens : 0 }))
    .sort((a, b) => b.sessions - a.sessions);

  const byModeMap = new Map<string, number>();
  for (const s of allSessions) byModeMap.set(s.mode, (byModeMap.get(s.mode) ?? 0) + 1);
  const byMode: ModeStats[] = Array.from(byModeMap.entries())
    .map(([mode, sessions]) => ({ mode, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  const byLayerMap = new Map<'L1' | 'L2' | 'L3', { count: number; totalInputTokens: number; totalOutputTokens: number; totalSaved: number }>();
  for (const ev of events) {
    if (ev.type === 'L1' || ev.type === 'L2' || ev.type === 'L3') {
      const l = byLayerMap.get(ev.type) ?? { count: 0, totalInputTokens: 0, totalOutputTokens: 0, totalSaved: 0 };
      l.count++;
      l.totalInputTokens += ev.inputTokens;
      l.totalSaved += ev.inputTokens - ev.compressedInputTokens;
      byLayerMap.set(ev.type, l);
    }
  }
  const byLayer: LayerStats[] = Array.from(byLayerMap.entries())
    .map(([layer, v]) => ({ layer, ...v, avgRatio: v.totalInputTokens > 0 ? v.totalSaved / v.totalInputTokens : 0 }));

  const totalInputTokens = allSessions.reduce((sum, s) => sum + s.totalInputTokens, 0);
  const totalOriginalInputTokens = allSessions.reduce((sum, s) => sum + s.totalOriginalInputTokens, 0);
  const totalOutputTokens = allSessions.reduce((sum, s) => sum + s.totalOutputTokens, 0);
  const totalSaved = totalOriginalInputTokens - totalInputTokens;

  return {
    totalSessions: allSessions.length,
    totalEvents: events.length,
    totalInputTokens,
    totalOriginalInputTokens,
    totalOutputTokens,
    totalSaved,
    avgRatio: totalOriginalInputTokens > 0 ? totalSaved / totalOriginalInputTokens : 0,
    byModel,
    byMode,
    byLayer,
  };
}
