import { describe, test, expect } from 'bun:test';
import type { PluginInput } from '@opencode-ai/plugin';
import { buildSdkSummarizerClient } from '../src/hooks/chat-experimental';
import { summarizeWithRetry } from '../src/layers/layer3-semantic';

function createMockInput(responses: Array<{ parts?: { type: string; text?: string }[] } | Error>): PluginInput {
  let callIndex = 0;
  return {
    client: {
      session: {
        prompt: async () => {
          const r = responses[callIndex++];
          if (r instanceof Error) throw r;
          return r;
        },
      },
    },
  } as unknown as PluginInput;
}

describe('buildSdkSummarizerClient (real SDK wiring)', () => {
  test('extracts text from response parts', async () => {
    const input = createMockInput([{ parts: [{ type: 'text', text: 'summarized content' }] }]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6', 'low');
    const result = await client.prompt({ prompt: 'test' });
    expect(result).toBe('summarized content');
  });

  test('concatenates multiple text parts', async () => {
    const input = createMockInput([
      { parts: [{ type: 'text', text: 'part1' }, { type: 'text', text: 'part2' }] },
    ]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6');
    const result = await client.prompt({ prompt: 'test' });
    expect(result).toBe('part1\npart2');
  });

  test('returns empty string when no parts', async () => {
    const input = createMockInput([{ parts: [] }]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6');
    const result = await client.prompt({ prompt: 'test' });
    expect(result).toBe('');
  });

  test('returns empty string when parts missing entirely', async () => {
    const input = createMockInput([{}]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6');
    const result = await client.prompt({ prompt: 'test' });
    expect(result).toBe('');
  });

  test('throws wrapped error when SDK call fails', async () => {
    const input = createMockInput([new Error('network timeout')]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6');
    await expect(client.prompt({ prompt: 'test' })).rejects.toThrow('SDK summarizer call failed');
  });

  test('uses model from options over default', async () => {
    let receivedModel = '';
    const input: PluginInput = {
      client: {
        session: {
          prompt: async (req: { body: { model: { modelID: string } } }) => {
            receivedModel = req.body.model.modelID;
            return { parts: [{ type: 'text', text: 'ok' }] };
          },
        },
      },
    } as unknown as PluginInput;
    const client = buildSdkSummarizerClient(input, 'default-model');
    await client.prompt({ prompt: 'x', model: 'override-model' });
    expect(receivedModel).toBe('override-model');
  });

  test('falls back to default model when not specified', async () => {
    let receivedModel = '';
    const input: PluginInput = {
      client: {
        session: {
          prompt: async (req: { body: { model: { modelID: string } } }) => {
            receivedModel = req.body.model.modelID;
            return { parts: [{ type: 'text', text: 'ok' }] };
          },
        },
      },
    } as unknown as PluginInput;
    const client = buildSdkSummarizerClient(input, 'fallback-model');
    await client.prompt({ prompt: 'x' });
    expect(receivedModel).toBe('fallback-model');
  });
});

describe('SDK client + summarizeWithRetry integration', () => {
  test('successful LLM call passes verification', async () => {
    const input = createMockInput([
      { parts: [{ type: 'text', text: 'src/foo.ts validateUserToken was called' }] },
    ]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6');
    const result = await summarizeWithRetry(
      'src/foo.ts validateUserToken was called',
      client
    );
    expect(result.summary).toBe('src/foo.ts validateUserToken was called');
    expect(result.fellBack).toBe(false);
    expect(result.attempts).toBe(1);
  });

  test('LLM that omits critical info falls back after retry', async () => {
    const input = createMockInput([
      // First call: missing identifier
      { parts: [{ type: 'text', text: 'did stuff' }] },
      // Second call: also missing
      { parts: [{ type: 'text', text: 'did more stuff' }] },
    ]);
    const client = buildSdkSummarizerClient(input, 'kimi-k2.6');
    const result = await summarizeWithRetry('src/foo.ts validateUserToken', client, {
      maxRetries: 1,
    });
    expect(result.fellBack).toBe(true);
    expect(result.summary).toBeNull();
    expect(result.attempts).toBe(2);
  });
});
