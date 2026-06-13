import { Logger } from '../utils/logger';
import { compressToolOutput } from '../layers/layer1-tool-output';
import { compressFileContent } from '../layers/layer2-file-content';
import { shouldApplyLayer } from '../modes';
import type { CompressionMode, PluginConfig } from '../types';

interface SessionState {
  config: PluginConfig;
  mode: CompressionMode;
}

const sessionStates = new Map<string, SessionState>();

export function setSessionState(sessionID: string, state: SessionState): void {
  sessionStates.set(sessionID, state);
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

      if (isRead && shouldApplyLayer(state.mode, 'fileContent')) {
        const filepath = (hookInput.args as { path?: string } | undefined)?.path ?? '';
        const layer2Result = compressFileContent(filepath, layer1Result.compressed, state.config.layers.fileContent);
        finalOutput = layer2Result.compressed;
        if (layer2Result.method !== 'none') {
          Logger.info(
            `L2 strip ${filepath} ${layer2Result.originalTokens}→${layer2Result.compressedTokens} tokens (${Math.round(layer2Result.ratio * 100)}%)`
          );
        }
      }

      if (layer1Result.method !== 'none') {
        Logger.info(
          `L1 ${hookInput.tool} ${layer1Result.originalTokens}→${layer1Result.compressedTokens} tokens (${Math.round(layer1Result.ratio * 100)}%)`
        );
        output.output = finalOutput;
      }
    } catch (error) {
      // Fail-safe: log and pass through unchanged
      Logger.error(`tool.execute.after failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
