import { Logger } from '../utils/logger';
import { compressToolOutput } from '../layers/layer1-tool-output';
import { compressFileContent } from '../layers/layer2-file-content';
import { shouldApplyLayer } from '../modes';
import { getStatsEmitter } from '../stats-emitter-singleton';
import { accumulateCompression } from './chat-message';
import type { CompressionMode, PluginConfig } from '../types';

export interface SessionState {
  config: PluginConfig;
  mode: CompressionMode;
}

const sessionStates = new Map<string, SessionState>();

export function setSessionState(sessionID: string, state: SessionState): void {
  sessionStates.set(sessionID, state);
}

export function getSessionState(sessionID: string): SessionState | undefined {
  return sessionStates.get(sessionID);
}

export function clearSessionState(sessionID: string): void {
  sessionStates.delete(sessionID);
}

export function createToolExecuteAfterHook() {
  return async (
    hookInput: { tool: string; sessionID: string; callID: string; args: unknown },
    output: { title: string; output: string; metadata: unknown }
  ): Promise<void> => {
    const state = sessionStates.get(hookInput.sessionID);
    if (!state) return;
    if (!shouldApplyLayer(state.mode, 'toolOutput')) return;

    try {
      const originalOutput = output.output;
      const isRead = hookInput.tool === 'read';

      const layer1Result = compressToolOutput(originalOutput, hookInput.tool, state.config.layers.toolOutput);
      let finalOutput = layer1Result.compressed;
      const layer1WasCompressed = layer1Result.method !== 'none';

      if (isRead && shouldApplyLayer(state.mode, 'fileContent')) {
        const filepath = (hookInput.args as { path?: string } | undefined)?.path ?? '';
        const layer2Result = compressFileContent(filepath, layer1Result.compressed, state.config.layers.fileContent);
        finalOutput = layer2Result.compressed;
        if (layer2Result.method !== 'none') {
          Logger.debug(
            `L2 strip ${filepath} ${layer2Result.inputTokens}→${layer2Result.compressedInputTokens} tokens (${Math.round(layer2Result.ratio * 100)}%)`
          );
          getStatsEmitter()?.emit({
            ts: Date.now() / 1000,
            type: 'L2',
            sessionId: hookInput.sessionID,
            file: filepath,
            inputTokens: layer2Result.inputTokens,
            compressedInputTokens: layer2Result.compressedInputTokens,
            ratio: layer2Result.ratio,
          });
          accumulateCompression(hookInput.sessionID, layer2Result.inputTokens, layer2Result.compressedInputTokens);
        }
      }

      Logger.debug(
        `L1 ${hookInput.tool} ${layer1Result.inputTokens}→${layer1Result.compressedInputTokens} tokens (${Math.round(layer1Result.ratio * 100)}%) [${layer1Result.method}]`
      );
      getStatsEmitter()?.emit({
        ts: Date.now() / 1000,
        type: 'L1',
        sessionId: hookInput.sessionID,
        tool: hookInput.tool,
        inputTokens: layer1Result.inputTokens,
        compressedInputTokens: layer1Result.compressedInputTokens,
        ratio: layer1Result.ratio,
        method: layer1Result.method as 'none' | 'truncate',
      });
      accumulateCompression(hookInput.sessionID, layer1Result.inputTokens, layer1Result.compressedInputTokens);

      if (layer1WasCompressed) {
        output.output = finalOutput;
      }
    } catch (error) {
      Logger.error(`tool.execute.after failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
