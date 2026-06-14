import { Logger } from '../utils/logger';
import { getSessionTotals, clearSessionTurnState } from './chat-message.js';
import { addMessageCost, clearMessageCost, getMessageCost } from './chat-message.js';
import { addOutputTokens } from './chat-message.js';
import { clearSessionState } from './tool-execute-after.js';
import { getStatsEmitter } from '../stats-emitter-singleton.js';
import type { SessionState } from './tool-execute-after.js';

interface SessionStartTimeMap {
  get(id: string): number | undefined;
  set(id: string, ts: number): void;
  delete(id: string): void;
}

/**
 * Dedupes message.updated events for a given assistant message.
 * opencode emits message.updated multiple times during streaming; we only
 * want to count output tokens + cost once per final message.
 */
const countedMessageIds = new Set<string>();

export function createEventHook(
  _getSessionState: (id: string) => SessionState | undefined,
  sessionStartTimes: SessionStartTimeMap
) {
  return async (eventInput: { event: { type: string; properties?: unknown } }): Promise<void> => {
    const t = eventInput.event?.type;

    // === message.updated: track exact output tokens + cost from AssistantMessage ===
    if (t === 'message.updated') {
      const props = eventInput.event?.properties as { info?: {
        id?: string;
        sessionID?: string;
        role?: string;
        cost?: number;
        tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } };
      } } | undefined;

      const info = props?.info;
      if (!info) return;
      if (info.role !== 'assistant') return;
      if (!info.id) return;
      if (countedMessageIds.has(info.id)) return;

      const tokens = info.tokens;
      const outputTokens = tokens?.output ?? 0;
      const messageCost = info.cost ?? 0;
      if (outputTokens === 0 && messageCost === 0) return;

      countedMessageIds.add(info.id);
      const sid = info.sessionID;
      if (!sid) return;

      addOutputTokens(sid, outputTokens);
      addMessageCost(sid, messageCost);
      Logger.debug(
        `[event:message.updated] session=${sid.slice(0, 8)}… msg=${info.id.slice(0, 8)}… role=assistant out=${outputTokens} cost=$${messageCost.toFixed(6)}`
      );
      return;
    }

    // === session.status (modern) and session.idle (deprecated): emit session.end ===
    if (t === 'session.status' || t === 'session.idle') {
      const props = eventInput.event?.properties as { sessionID?: string; status?: { type?: string } } | undefined;
      const sid = props?.sessionID;
      if (!sid) return;
      // For session.status, only emit on "idle" or "ready" status (not "busy")
      if (t === 'session.status' && props?.status?.type && props.status.type !== 'idle' && props.status.type !== 'ready') {
        return;
      }
      const totals = getSessionTotals(sid);
      if (!totals) return;
      if (totals.totalInputTokens === 0 && totals.totalOutputTokens === 0 && totals.totalOriginalInputTokens === 0) return;

      const now = Date.now() / 1000;
      const startTs = sessionStartTimes.get(sid);
      const durationMs = startTs !== undefined ? Math.max(0, (now - startTs) * 1000) : 0;
      const actualCost = getMessageCost(sid);
      getStatsEmitter()?.emit({
        ts: now,
        type: 'session.end',
        sessionId: sid,
        durationMs,
        totalInputTokens: totals.totalInputTokens,
        totalOriginalInputTokens: totals.totalOriginalInputTokens,
        totalOutputTokens: totals.totalOutputTokens,
        actualCost,
      });
      Logger.debug(
        `[event:${t}] emitted session.end for ${sid.slice(0, 8)}… in=${totals.totalInputTokens} out=${totals.totalOutputTokens} actualCost=$${actualCost.toFixed(6)}`
      );
      return;
    }

    // === session.deleted / session.compacted: emit session.end then cleanup ===
    if (t === 'session.deleted' || t === 'session.compacted') {
      const props = eventInput.event?.properties as { sessionID?: string } | undefined;
      const sid = props?.sessionID;
      if (!sid) return;
      const totals = getSessionTotals(sid);
      if (totals && (totals.totalInputTokens > 0 || totals.totalOutputTokens > 0 || totals.totalOriginalInputTokens > 0)) {
        const startTs = sessionStartTimes.get(sid);
        const now = Date.now() / 1000;
        const durationMs = startTs !== undefined ? Math.max(0, (now - startTs) * 1000) : 0;
        const actualCost = getMessageCost(sid);
        getStatsEmitter()?.emit({
          ts: now,
          type: 'session.end',
          sessionId: sid,
          durationMs,
          totalInputTokens: totals.totalInputTokens,
          totalOriginalInputTokens: totals.totalOriginalInputTokens,
          totalOutputTokens: totals.totalOutputTokens,
          actualCost,
        });
      }
      clearSessionState(sid);
      clearSessionTurnState(sid);
      clearMessageCost(sid);
      sessionStartTimes.delete(sid);
      Logger.debug(`[event:${t}] cleaned up session ${sid.slice(0, 8)}…`);
      return;
    }
  };
}
