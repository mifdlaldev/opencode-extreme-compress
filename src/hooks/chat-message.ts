import { Logger } from '../utils/logger';
import { countTokens } from '../utils/token-counter';
import type { CompressionMode, PluginConfig } from '../types';

interface SessionTurnState {
  config: PluginConfig;
  mode: CompressionMode;
  turnCount: number;
  totalOutputTokens: number;
  totalInputTokens: number;
  totalOriginalInputTokens: number;
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

/**
 * Accumulate L1/L2/L3 compression stats for session totals.
 * Called by tool-execute-after and chat-experimental after emitting compression events.
 */
export function accumulateCompression(
  sessionID: string,
  inputTokens: number,
  compressedInputTokens: number
): void {
  const s = turnStates.get(sessionID);
  if (!s) return;
  s.totalOriginalInputTokens += inputTokens;
  s.totalInputTokens += compressedInputTokens;
}

export function getSessionTotals(sessionID: string): {
  totalInputTokens: number;
  totalOriginalInputTokens: number;
  totalOutputTokens: number;
} | undefined {
  const s = turnStates.get(sessionID);
  if (!s) return undefined;
  return {
    totalInputTokens: s.totalInputTokens,
    totalOriginalInputTokens: s.totalOriginalInputTokens,
    totalOutputTokens: s.totalOutputTokens,
  };
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
    output: { message: { role?: string }; parts: { type: string; text?: string }[] }
  ): Promise<void> => {
    const state = turnStates.get(hookInput.sessionID);
    if (!state) return;
    state.turnCount++;
    Logger.debug(
      `[chat.message] session=${hookInput.sessionID} turn=${state.turnCount} model=${hookInput.model?.modelID ?? 'unknown'}`
    );

    if (output.message?.role === 'assistant') {
      const text = (output.parts ?? [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
      if (text.length > 0) {
        state.totalOutputTokens += countTokens(text);
      }
    }
  };
}
