import { Logger } from '../utils/logger';
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

export function addOutputTokens(sessionID: string, tokens: number): void {
  const s = turnStates.get(sessionID);
  if (!s) return;
  s.totalOutputTokens += tokens;
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
      `[chat.message] session=${hookInput.sessionID.slice(0, 8)}… turn=${state.turnCount} model=${hookInput.model?.modelID ?? 'unknown'} role=${output.message?.role ?? '?'}`
    );
  };
}
