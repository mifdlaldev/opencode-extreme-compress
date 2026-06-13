import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './config';
import { resolveEffectiveMode } from './modes';
import { Logger } from './utils/logger';
import { createToolExecuteBeforeHook } from './hooks/tool-execute-before';
import { createToolExecuteAfterHook, setSessionState } from './hooks/tool-execute-after';
import {
  createChatMessageHook,
  setSessionTurnState,
} from './hooks/chat-message';
import {
  createMessagesTransformHook,
  createSessionCompactingHook,
} from './hooks/chat-experimental';

const configPath =
  process.env.EXTREME_COMPRESS_CONFIG ?? `${process.env.HOME ?? ''}/.config/opencode/compress.jsonc`;

const sessionModels = new Map<string, string>();

export const ExtremeCompressPlugin: Plugin = async () => {
  Logger.info(`Loading extreme-compress plugin (config: ${configPath})`);
  const config = await loadConfig(configPath);
  Logger.info(
    `Config loaded: mode=${config.mode}, profiles=${Object.keys(config.modelProfiles).length}`
  );

  const toolBefore = createToolExecuteBeforeHook();
  const toolAfter = createToolExecuteAfterHook();
  const chatMsg = createChatMessageHook();
  const messagesTransform = createMessagesTransformHook();
  const sessionCompacting = createSessionCompactingHook();

  return {
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

      // Initialize session state on first message
      if (!sessionModels.has(hookInput.sessionID)) {
        setSessionState(hookInput.sessionID, { config, mode });
        setSessionTurnState(hookInput.sessionID, { config, mode, turnCount: 0 });
        sessionModels.set(hookInput.sessionID, modelId);
      }
      return chatMsg(hookInput, output);
    },
    'experimental.chat.messages.transform': messagesTransform,
    'experimental.session.compacting': sessionCompacting,
  };
};

export default ExtremeCompressPlugin;
