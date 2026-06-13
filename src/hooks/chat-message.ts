import { Logger } from '../utils/logger';
import type { CompressionMode, PluginConfig } from '../types';

interface SessionTurnState {
  config: PluginConfig;
  mode: CompressionMode;
  turnCount: number;
}

const turnStates = new Map<string, SessionTurnState>();

export function getSessionTurnState(sessionID: string): SessionTurnState | undefined {
  return turnStates.get(sessionID);
}

export function setSessionTurnState(sessionID: string, state: SessionTurnState): void {
  turnStates.set(sessionID, state);
}

export function clearSessionTurnState(sessionID: string): void {
  turnStates.delete(sessionID);
}

export function createChatMessageHook() {
  return async (
    hookInput: {
      sessionID: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      messageID?: string;
      variant?: string;
    },
    _output: { message: unknown; parts: unknown[] }
  ): Promise<void> => {
    const state = turnStates.get(hookInput.sessionID);
    if (state) {
      state.turnCount++;
      Logger.debug(
        `[chat.message] session=${hookInput.sessionID} turn=${state.turnCount} model=${hookInput.model?.modelID ?? 'unknown'}`
      );
    }
  };
}
