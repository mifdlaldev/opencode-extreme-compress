import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './config';
import { resolveEffectiveMode } from './modes';
import { Logger } from './utils/logger';
import { createToolExecuteBeforeHook } from './hooks/tool-execute-before';
import { createToolExecuteAfterHook, setSessionState, clearSessionState } from './hooks/tool-execute-after';
import {
  createChatMessageHook,
  setSessionTurnState,
  clearSessionTurnState,
  getSessionTotals,
} from './hooks/chat-message';
import {
  createMessagesTransformHook,
  createSessionCompactingHook,
} from './hooks/chat-experimental';
import { StatsEmitter } from './stats-emitter';
import { setStatsEmitter, getStatsEmitter } from './stats-emitter-singleton';

const configPath =
  process.env.EXTREME_COMPRESS_CONFIG ??
  `${process.env.HOME ?? ''}/.config/opencode/extreme-compress.jsonc`;

const sessionModels = new Map<string, string>();
const sessionStartTimes = new Map<string, number>();

export const ExtremeCompressPlugin: Plugin = async (input) => {
  Logger.debug(`Loading extreme-compress plugin (config: ${configPath})`);
  const config = await loadConfig(configPath);
  Logger.debug(
    `Config loaded: mode=${config.mode}, profiles=${Object.keys(config.modelProfiles).length}`
  );

  const statsEmitter = new StatsEmitter(config.stats);
  setStatsEmitter(statsEmitter);

  const toolBefore = createToolExecuteBeforeHook();
  const toolAfter = createToolExecuteAfterHook();
  const chatMsg = createChatMessageHook();
  const messagesTransform = createMessagesTransformHook(input);
  const sessionCompacting = createSessionCompactingHook();

  return {
    event: async (eventInput: { event: { type: string; properties?: unknown } }) => {
      const t = eventInput.event?.type;
      if (t === 'session.deleted' || t === 'session.compacted') {
        const props = eventInput.event?.properties as { sessionID?: string } | undefined;
        const sid = props?.sessionID;
        if (sid) {
          const totals = getSessionTotals(sid);
          const startTs = sessionStartTimes.get(sid);
          const now = Date.now() / 1000;
          if (totals && (totals.totalInputTokens > 0 || totals.totalOutputTokens > 0 || totals.totalOriginalInputTokens > 0)) {
            const durationMs = startTs !== undefined ? (now - startTs) * 1000 : 0;
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
          sessionModels.delete(sid);
          sessionStartTimes.delete(sid);
          Logger.debug(`Cleaned up session state for ${sid.slice(0, 8)}…`);
        }
      }
    },
    'tool.execute.before': toolBefore,
    'tool.execute.after': toolAfter,
    'chat.message': async (
      hookInput: {
        sessionID: string;
        agent?: string;
        model?: { providerID: string; modelID: string };
        messageID?: string;
        variant?: string;
      },
      output: { message: { role?: string }; parts: { type: string; text?: string }[] }
    ): Promise<void> => {
      const modelId = hookInput.model?.modelID ?? '';
      const mode = resolveEffectiveMode(config, modelId);

      if (!sessionModels.has(hookInput.sessionID)) {
        setSessionState(hookInput.sessionID, { config, mode });
        setSessionTurnState(hookInput.sessionID, {
          config,
          mode,
          turnCount: 0,
          totalInputTokens: 0,
          totalOriginalInputTokens: 0,
          totalOutputTokens: 0,
        });
        sessionModels.set(hookInput.sessionID, modelId);
        sessionStartTimes.set(hookInput.sessionID, Date.now() / 1000);
        getStatsEmitter()?.emit({
          ts: Date.now() / 1000,
          type: 'session.start',
          sessionId: hookInput.sessionID,
          model: modelId,
          mode,
        });
        Logger.debug(
          `Session ${hookInput.sessionID.slice(0, 8)}… initialized: model=${modelId || 'unknown'} mode=${mode}`
        );
      }
      return chatMsg(hookInput, output);
    },
    'experimental.chat.messages.transform': messagesTransform,
    'experimental.session.compacting': sessionCompacting,
  };
};

export default ExtremeCompressPlugin;
