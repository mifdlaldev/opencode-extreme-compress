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
} from './hooks/chat-message';
import {
  createMessagesTransformHook,
  createSessionCompactingHook,
} from './hooks/chat-experimental';

const configPath =
  process.env.EXTREME_COMPRESS_CONFIG ??
  `${process.env.HOME ?? ''}/.config/opencode/extreme-compress.jsonc`;

const sessionModels = new Map<string, string>();

export const ExtremeCompressPlugin: Plugin = async (input) => {
  Logger.info(`Loading extreme-compress plugin (config: ${configPath})`);
  const config = await loadConfig(configPath);
  Logger.info(
    `Config loaded: mode=${config.mode}, profiles=${Object.keys(config.modelProfiles).length}`
  );

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
          clearSessionState(sid);
          clearSessionTurnState(sid);
          sessionModels.delete(sid);
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
      output: { message: unknown; parts: unknown[] }
    ): Promise<void> => {
      const modelId = hookInput.model?.modelID ?? '';
      const mode = resolveEffectiveMode(config, modelId);

      if (!sessionModels.has(hookInput.sessionID)) {
        setSessionState(hookInput.sessionID, { config, mode });
        setSessionTurnState(hookInput.sessionID, { config, mode, turnCount: 0 });
        sessionModels.set(hookInput.sessionID, modelId);
        Logger.info(
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
