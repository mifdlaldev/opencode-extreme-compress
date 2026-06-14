import { Logger } from '../utils/logger';
import { countTokens } from '../utils/token-counter';
import {
  addOutputTokens,
  getSessionTotals,
  clearSessionTurnState,
} from './chat-message.js';
import { clearSessionState } from './tool-execute-after.js';
import { getStatsEmitter } from '../stats-emitter-singleton.js';
import type { SessionState } from './tool-execute-after.js';

interface EventProperties {
  sessionID?: string;
  messageID?: string;
  message?: {
    id?: string;
    sessionID?: string;
    role?: string;
    parts?: { type: string; text?: string }[];
  };
}

/**
 * Dedupes message.updated events for a given assistant message.
 * opencode emits message.updated multiple times during streaming; we only
 * want to count output tokens once per final message.
 */
const countedMessageIds = new Set<string>();

export function createEventHook(
  getSessionState: (id: string) => SessionState | undefined,
  sessionStartTimes: Map<string, number>,
  sessionModels: Map<string, string>
) {
  return async (eventInput: { event: { type: string; properties?: unknown } }): Promise<void> => {
    const t = eventInput.event?.type;

    if (t === 'message.updated') {
      const props = eventInput.event?.properties as EventProperties | undefined;
      const msg = props?.message;
      if (!msg) return;
      if (msg.role !== 'assistant') return;
      if (!msg.id) return;
      if (countedMessageIds.has(msg.id)) return;

      const text = (msg.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
      if (text.length === 0) return;

      countedMessageIds.add(msg.id);
      const sid = msg.sessionID ?? props?.sessionID;
      if (!sid) return;

      const tokens = countTokens(text);
      addOutputTokens(sid, tokens);
      Logger.debug(
        `[event:message.updated] session=${sid.slice(0, 8)}… msg=${msg.id.slice(0, 8)}… role=assistant +${tokens} output tokens (${text.length} chars)`
      );
      return;
    }

    if (t === 'session.idle') {
      const props = eventInput.event?.properties as EventProperties | undefined;
      const sid = props?.sessionID;
      if (!sid) return;
      if (!getSessionState(sid)) return;
      const totals = getSessionTotals(sid);
      const startTs = sessionStartTimes.get(sid);
      if (!totals) return;
      if (
        totals.totalInputTokens === 0 &&
        totals.totalOutputTokens === 0 &&
        totals.totalOriginalInputTokens === 0
      ) {
        return;
      }

      const now = Date.now() / 1000;
      const durationMs = startTs !== undefined ? Math.max(0, (now - startTs) * 1000) : 0;
      getStatsEmitter()?.emit({
        ts: now,
        type: 'session.end',
        sessionId: sid,
        durationMs,
        totalInputTokens: totals.totalInputTokens,
        totalOriginalInputTokens: totals.totalOriginalInputTokens,
        totalOutputTokens: totals.totalOutputTokens,
      });
      Logger.debug(
        `[event:session.idle] emitted session.end for ${sid.slice(0, 8)}… in=${totals.totalInputTokens} out=${totals.totalOutputTokens}`
      );
      return;
    }

    if (t === 'session.deleted' || t === 'session.compacted') {
      const props = eventInput.event?.properties as EventProperties | undefined;
      const sid = props?.sessionID;
      if (!sid) return;
      const totals = getSessionTotals(sid);
      if (
        totals &&
        (totals.totalInputTokens > 0 ||
          totals.totalOutputTokens > 0 ||
          totals.totalOriginalInputTokens > 0)
      ) {
        const startTs = sessionStartTimes.get(sid);
        const now = Date.now() / 1000;
        const durationMs = startTs !== undefined ? Math.max(0, (now - startTs) * 1000) : 0;
        getStatsEmitter()?.emit({
          ts: now,
          type: 'session.end',
          sessionId: sid,
          durationMs,
          totalInputTokens: totals.totalInputTokens,
          totalOriginalInputTokens: totals.totalOriginalInputTokens,
          totalOutputTokens: totals.totalOutputTokens,
        });
      }
      clearSessionState(sid);
      clearSessionTurnState(sid);
      sessionStartTimes.delete(sid);
      sessionModels.delete(sid);
      Logger.debug(`[event:${t}] cleaned up session ${sid.slice(0, 8)}…`);
      return;
    }
  };
}
