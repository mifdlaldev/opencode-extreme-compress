import type { StatsEvent, SessionStats, ModelStats, ModeStats, LayerStats, OverallStats, Pricing } from './types.js';
import { findPricing } from './pricing.js';

export interface CostBreakdown {
  costInput: number;
  costInputOriginal: number;
  costOutput: number;
  costTotal: number;
  costTotalOriginal: number;
  costSaved: number;
}

function compressionTokens(ev: { inputTokens?: number; compressedInputTokens?: number; orig?: number; comp?: number }): { input: number; compressed: number } {
  return {
    input: ev.inputTokens ?? ev.orig ?? 0,
    compressed: ev.compressedInputTokens ?? ev.comp ?? 0,
  };
}

function computeCost(
  totalOriginalInputTokens: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  pricing: Pricing | undefined
): CostBreakdown {
  if (!pricing) {
    return { costInput: 0, costInputOriginal: 0, costOutput: 0, costTotal: 0, costTotalOriginal: 0, costSaved: 0 };
  }
  const costInputOriginal = (totalOriginalInputTokens / 1_000_000) * pricing.inputPerMTok;
  const costInput = (totalInputTokens / 1_000_000) * pricing.inputPerMTok;
  const costOutput = (totalOutputTokens / 1_000_000) * pricing.outputPerMTok;
  const costTotal = costInput + costOutput;
  const costTotalOriginal = costInputOriginal + costOutput;
  const costSaved = costTotalOriginal - costTotal;
  return { costInput, costInputOriginal, costOutput, costTotal, costTotalOriginal, costSaved };
}

function newSessionEntry(
  sessionId: string,
  model: string,
  mode: string,
  startTs: number,
  pricing: Pricing | undefined
): SessionStats {
  return {
    sessionId, model, mode, startTs,
    l1Count: 0, l2Count: 0, l3Count: 0,
    totalOriginalInputTokens: 0, totalInputTokens: 0, totalOutputTokens: 0,
    totalSaved: 0, errorCount: 0,
    costInput: 0, costInputOriginal: 0, costOutput: 0, costTotal: 0, costTotalOriginal: 0, costSaved: 0,
    pricing,
  };
}

function getOrCreateSession(
  sessions: Map<string, SessionStats>,
  sessionId: string,
  pricingMap: Map<string, Pricing>
): SessionStats {
  let s = sessions.get(sessionId);
  if (!s) {
    s = newSessionEntry(sessionId, 'unknown', 'unknown', 0, findPricing('unknown', pricingMap));
    sessions.set(sessionId, s);
  }
  return s;
}

export function aggregateBySession(events: StatsEvent[], pricingMap: Map<string, Pricing>): Map<string, SessionStats> {
  const sessions = new Map<string, SessionStats>();
  for (const ev of events) {
    if (ev.type === 'session.start') {
      // Do NOT reset running totals on duplicate session.start (plugin reload
      // re-emits start for already-seen sessions; the previous in-memory
      // sessionModels Map is gone, but L1/L2/L3 sums must persist).
      const pricing = findPricing(ev.model, pricingMap);
      const existing = sessions.get(ev.sessionId);
      if (existing) {
        existing.model = ev.model;
        existing.mode = ev.mode;
        existing.startTs = Math.min(existing.startTs, ev.ts);
        existing.pricing = pricing ?? existing.pricing;
      } else {
        sessions.set(ev.sessionId, newSessionEntry(ev.sessionId, ev.model, ev.mode, ev.ts, pricing));
      }
    } else if (ev.type === 'session.end') {
      const s = sessions.get(ev.sessionId);
      if (s) {
        s.endTs = ev.ts;
        s.durationMs = ev.durationMs;
        if (typeof ev.totalOutputTokens === 'number') {
          s.totalOutputTokens = Math.max(s.totalOutputTokens, ev.totalOutputTokens);
        }
        const costs = computeCost(
          s.totalOriginalInputTokens,
          s.totalInputTokens,
          s.totalOutputTokens,
          s.pricing
        );
        Object.assign(s, costs);
      }
    } else if (ev.type === 'L1') {
      const s = getOrCreateSession(sessions, ev.sessionId, pricingMap);
      const t = compressionTokens(ev);
      s.l1Count++;
      s.totalOriginalInputTokens += t.input;
      s.totalInputTokens += t.compressed;
      s.totalSaved += t.input - t.compressed;
    } else if (ev.type === 'L2') {
      const s = getOrCreateSession(sessions, ev.sessionId, pricingMap);
      const t = compressionTokens(ev);
      s.l2Count++;
      s.totalOriginalInputTokens += t.input;
      s.totalInputTokens += t.compressed;
      s.totalSaved += t.input - t.compressed;
    } else if (ev.type === 'L3') {
      const s = getOrCreateSession(sessions, ev.sessionId, pricingMap);
      const t = compressionTokens(ev);
      s.l3Count++;
      s.totalOriginalInputTokens += t.input;
      s.totalInputTokens += t.compressed;
      s.totalSaved += t.input - t.compressed;
    } else if (ev.type === 'error') {
      const s = sessions.get(ev.sessionId);
      if (s) s.errorCount++;
    }
  }
  return sessions;
}

interface ModelAggregate {
  sessions: number;
  totalInputTokens: number;
  totalOriginalInputTokens: number;
  totalOutputTokens: number;
  totalSaved: number;
  costTotal: number;
  costTotalOriginal: number;
  costSaved: number;
  pricing?: Pricing;
}

export function aggregateOverall(events: StatsEvent[], pricingMap: Map<string, Pricing>): OverallStats {
  const sessions = aggregateBySession(events, pricingMap);
  const allSessions = Array.from(sessions.values());

  const byModelMap = new Map<string, ModelAggregate>();
  for (const s of allSessions) {
    const m = byModelMap.get(s.model) ?? {
      sessions: 0,
      totalInputTokens: 0,
      totalOriginalInputTokens: 0,
      totalOutputTokens: 0,
      totalSaved: 0,
      costTotal: 0,
      costTotalOriginal: 0,
      costSaved: 0,
      pricing: s.pricing,
    };
    m.sessions++;
    m.totalInputTokens += s.totalInputTokens;
    m.totalOriginalInputTokens += s.totalOriginalInputTokens;
    m.totalOutputTokens += s.totalOutputTokens;
    m.totalSaved += s.totalSaved;
    m.costTotal += s.costTotal;
    m.costTotalOriginal += s.costTotalOriginal;
    m.costSaved += s.costSaved;
    byModelMap.set(s.model, m);
  }
  const byModel: ModelStats[] = Array.from(byModelMap.entries())
    .map(([model, v]) => ({
      model,
      sessions: v.sessions,
      totalInputTokens: v.totalInputTokens,
      totalOriginalInputTokens: v.totalOriginalInputTokens,
      totalOutputTokens: v.totalOutputTokens,
      totalSaved: v.totalSaved,
      avgRatio: v.totalOriginalInputTokens > 0 ? v.totalSaved / v.totalOriginalInputTokens : 0,
      costTotal: v.costTotal,
      costTotalOriginal: v.costTotalOriginal,
      costSaved: v.costSaved,
      pricing: v.pricing,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const byModeMap = new Map<string, number>();
  for (const s of allSessions) byModeMap.set(s.mode, (byModeMap.get(s.mode) ?? 0) + 1);
  const byMode: ModeStats[] = Array.from(byModeMap.entries())
    .map(([mode, sessions]) => ({ mode, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  const byLayerMap = new Map<'L1' | 'L2' | 'L3', { count: number; totalInputTokens: number; totalOutputTokens: number; totalSaved: number }>();
  for (const ev of events) {
    if (ev.type === 'L1' || ev.type === 'L2' || ev.type === 'L3') {
      const t = compressionTokens(ev);
      const l = byLayerMap.get(ev.type) ?? { count: 0, totalInputTokens: 0, totalOutputTokens: 0, totalSaved: 0 };
      l.count++;
      l.totalInputTokens += t.input;
      l.totalSaved += t.input - t.compressed;
      byLayerMap.set(ev.type, l);
    }
  }
  const byLayer: LayerStats[] = Array.from(byLayerMap.entries())
    .map(([layer, v]) => ({ layer, ...v, avgRatio: v.totalInputTokens > 0 ? v.totalSaved / v.totalInputTokens : 0 }));

  const totalInputTokens = allSessions.reduce((sum, s) => sum + s.totalInputTokens, 0);
  const totalOriginalInputTokens = allSessions.reduce((sum, s) => sum + s.totalOriginalInputTokens, 0);
  const totalOutputTokens = allSessions.reduce((sum, s) => sum + s.totalOutputTokens, 0);
  const totalSaved = totalOriginalInputTokens - totalInputTokens;
  const costTotal = allSessions.reduce((sum, s) => sum + s.costTotal, 0);
  const costTotalOriginal = allSessions.reduce((sum, s) => sum + s.costTotalOriginal, 0);
  const costSaved = costTotalOriginal - costTotal;
  const modelsWithPricing = byModel.filter(m => m.pricing !== undefined).length;

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
    costTotal,
    costTotalOriginal,
    costSaved,
    modelsWithPricing,
  };
}
