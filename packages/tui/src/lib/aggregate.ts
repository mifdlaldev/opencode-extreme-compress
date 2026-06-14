import type { StatsEvent, SessionStats, ModelStats, ModeStats, LayerStats, OverallStats } from './types.js';

export function aggregateBySession(events: StatsEvent[]): Map<string, SessionStats> {
  const sessions = new Map<string, SessionStats>();
  for (const ev of events) {
    if (ev.type === 'session.start') {
      sessions.set(ev.sessionId, {
        sessionId: ev.sessionId, model: ev.model, mode: ev.mode, startTs: ev.ts,
        l1Count: 0, l2Count: 0, l3Count: 0,
        l1Saved: 0, l2Saved: 0, l3Saved: 0,
        totalSaved: 0, totalOrig: 0, errorCount: 0,
      });
    } else if (ev.type === 'session.end') {
      const s = sessions.get(ev.sessionId);
      if (s) { s.endTs = ev.ts; s.durationMs = ev.durationMs; }
    } else if (ev.type === 'L1') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.l1Count++;
        s.l1Saved += (ev.orig - ev.comp);
        s.totalOrig += ev.orig;
        s.totalSaved += (ev.orig - ev.comp);
      }
    } else if (ev.type === 'L2') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.l2Count++;
        s.l2Saved += (ev.orig - ev.comp);
        s.totalOrig += ev.orig;
        s.totalSaved += (ev.orig - ev.comp);
      }
    } else if (ev.type === 'L3') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.l3Count++;
        s.l3Saved += (ev.orig - ev.comp);
        s.totalOrig += ev.orig;
        s.totalSaved += (ev.orig - ev.comp);
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

  const byModelMap = new Map<string, { sessions: number; totalOrig: number; totalSaved: number }>();
  for (const s of allSessions) {
    const m = byModelMap.get(s.model) ?? { sessions: 0, totalOrig: 0, totalSaved: 0 };
    m.sessions++;
    m.totalOrig += s.totalOrig;
    m.totalSaved += s.totalSaved;
    byModelMap.set(s.model, m);
  }
  const byModel: ModelStats[] = Array.from(byModelMap.entries())
    .map(([model, v]) => ({ model, ...v, avgRatio: v.totalOrig > 0 ? v.totalSaved / v.totalOrig : 0 }))
    .sort((a, b) => b.sessions - a.sessions);

  const byModeMap = new Map<string, number>();
  for (const s of allSessions) byModeMap.set(s.mode, (byModeMap.get(s.mode) ?? 0) + 1);
  const byMode: ModeStats[] = Array.from(byModeMap.entries())
    .map(([mode, sessions]) => ({ mode, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  const byLayerMap = new Map<'L1' | 'L2' | 'L3', { count: number; totalOrig: number; totalSaved: number }>();
  for (const ev of events) {
    if (ev.type === 'L1' || ev.type === 'L2' || ev.type === 'L3') {
      const l = byLayerMap.get(ev.type) ?? { count: 0, totalOrig: 0, totalSaved: 0 };
      l.count++;
      l.totalOrig += ev.orig;
      l.totalSaved += (ev.orig - ev.comp);
      byLayerMap.set(ev.type, l);
    }
  }
  const byLayer: LayerStats[] = Array.from(byLayerMap.entries())
    .map(([layer, v]) => ({ layer, ...v, avgRatio: v.totalOrig > 0 ? v.totalSaved / v.totalOrig : 0 }));

  const totalOrig = allSessions.reduce((sum, s) => sum + s.totalOrig, 0);
  const totalSaved = allSessions.reduce((sum, s) => sum + s.totalSaved, 0);

  return {
    totalSessions: allSessions.length,
    totalEvents: events.length,
    totalOrig,
    totalSaved,
    avgRatio: totalOrig > 0 ? totalSaved / totalOrig : 0,
    byModel,
    byMode,
    byLayer,
  };
}
