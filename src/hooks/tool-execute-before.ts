import { Logger } from '../utils/logger';

/**
 * tool.execute.before hook — OBSERVE ONLY
 *
 * Per anti-hallucination charter principle #1, we DO NOT modify tool inputs.
 * Other plugins (e.g., rtk.ts) may modify output.args for command rewriting,
 * but we don't — we have no semantic-preserving rewrite. We only compress
 * tool RESULTS via tool.execute.after.
 *
 * This hook is for metrics and future must-preserve detection.
 */
export function createToolExecuteBeforeHook() {
  return async (
    hookInput: { tool: string; sessionID: string; callID: string },
    _output: { args: unknown }
  ): Promise<void> => {
    Logger.debug(`[tool.execute.before] tool=${hookInput.tool} callID=${hookInput.callID}`);
    // Intentionally no-op: do not modify output.args (by design).
    // Future: record metrics, detect must-preserve paths.
  };
}
