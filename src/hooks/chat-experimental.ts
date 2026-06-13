import { Logger } from '../utils/logger';
import { shouldApplyLayer } from '../modes';
import { getSessionTurnState } from './chat-message';
import { type SummarizerClient, summarizeWithRetry } from '../layers/layer3-semantic';

export function createMessagesTransformHook() {
  return async (
    _hookInput: Record<string, never>,
    output: { messages: { info: { sessionID?: string; role?: string }; parts: { type: string; text?: string }[] }[] }
  ): Promise<void> => {
    const sessionID = output.messages[0]?.info?.sessionID;
    if (!sessionID) return;

    const state = getSessionTurnState(sessionID);
    if (!state) return;
    if (!shouldApplyLayer(state.mode, 'semantic')) return;

    const trigger = state.config.layers.semantic.trigger;
    if (state.turnCount < trigger.minMessages) return;

    try {
      const recent = output.messages.slice(-trigger.keepRecent);
      const old = output.messages.slice(0, -trigger.keepRecent);
      if (old.length === 0) return;

      const oldText = old
        .map((m) => {
          const role = m.info?.role ?? 'unknown';
          const text = (m.parts || [])
            .filter((p) => p.type === 'text')
            .map((p) => p.text ?? '')
            .join('\n');
          return `${role.toUpperCase()}: ${text}`;
        })
        .join('\n\n');

      // Note: real impl would use input.client to call LLM. For v1 we use a stub
      // that returns the original (effectively a no-op when no client is wired).
      const stubClient: SummarizerClient = {
        prompt: async () => oldText, // v1 stub: just return original
      };

      const result = await summarizeWithRetry(oldText, stubClient, {
        model: state.config.layers.semantic.model,
        variant: state.config.layers.semantic.variant,
        maxRetries: 1,
      });

      if (result.summary && !result.fellBack) {
        output.messages = [
          {
            info: { sessionID, role: 'assistant' },
            parts: [
              {
                type: 'text',
                text: `[Summary of ${old.length} previous turns]\n\n${result.summary}\n\n[Recent ${recent.length} messages retained below]`,
              },
            ],
          },
          ...recent,
        ];
        Logger.info(`L3 compressed ${old.length} messages → 1 summary (attempts=${result.attempts})`);
      } else {
        Logger.warn(`L3 fell back, keeping ${old.length} original messages`);
      }
    } catch (error) {
      Logger.error(`messages.transform failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

export function createSessionCompactingHook() {
  return async (
    _hookInput: { sessionID: string },
    output: { context: string[]; prompt?: string }
  ): Promise<void> => {
    output.context = [
      ...(output.context ?? []),
      'CRITICAL: When summarizing, preserve verbatim: file paths, function/class/variable names, error messages, error codes, numeric values, and decisions made.',
    ];
  };
}
