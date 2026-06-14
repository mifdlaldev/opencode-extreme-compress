import type { PluginInput } from '@opencode-ai/plugin';
import { Logger } from '../utils/logger';
import { shouldApplyLayer } from '../modes';
import { getSessionTurnState } from './chat-message';
import { type SummarizerClient, summarizeWithRetry } from '../layers/layer3-semantic';

/**
 * Wire the opencode SDK client to a SummarizerClient for Layer 3.
 *
 * Uses client.session.prompt to call the configured model. The result is
 * extracted from the response parts. If the SDK call fails, throws — the
 * surrounding summarizeWithRetry handles retries and fall-back.
 */
function buildSdkSummarizerClient(input: PluginInput, model: string, variant?: string): SummarizerClient {
  return {
    prompt: async (opts) => {
      const sessionID = 'plugin-summarizer';
      try {
        const response = await input.client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [{ type: 'text' as const, text: opts.prompt }],
            model: { providerID: 'opencode', modelID: opts.model ?? model },
            ...(opts.variant ? { variant: opts.variant } : {}),
            ...(variant && !opts.variant ? { variant } : {}),
          },
        });

        // Extract text from response parts.
        const parts = (response as { parts?: { type: string; text?: string }[] }).parts ?? [];
        const text = parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text ?? '')
          .join('\n');
        return text;
      } catch (err) {
        throw new Error(
          `SDK summarizer call failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
  };
}

export function createMessagesTransformHook(input: PluginInput) {
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

      const client = buildSdkSummarizerClient(
        input,
        state.config.layers.semantic.model,
        state.config.layers.semantic.variant
      );

      const result = await summarizeWithRetry(oldText, client, {
        model: state.config.layers.semantic.model,
        variant: state.config.layers.semantic.variant,
        maxRetries: 2,
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
        Logger.info(
          `L3 compressed ${old.length} messages → 1 summary (attempts=${result.attempts})`
        );
      } else {
        Logger.warn(`L3 fell back, keeping ${old.length} original messages`);
      }
    } catch (error) {
      Logger.error(
        `messages.transform failed: ${error instanceof Error ? error.message : String(error)}`
      );
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
