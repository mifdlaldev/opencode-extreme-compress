import React from 'react';
import { Box, Text } from 'ink';
import type { StatsEvent } from '../lib/types.js';

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-US', { hour12: false });
}

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString();

function describeEvent(ev: StatsEvent): React.ReactElement {
  switch (ev.type) {
    case 'session.start':
      return <Text>session.start  <Text color="cyan">{ev.model}</Text>  mode=<Text color="yellow">{ev.mode}</Text></Text>;
    case 'session.end':
      return <Text>session.end    dur=<Text color="cyan">{(ev.durationMs / 1000).toFixed(1)}s</Text>  in=<Text color="green">{fmt(ev.totalInputTokens)}</Text>  out=<Text color="yellow">{fmt(ev.totalOutputTokens)}</Text>  saved=<Text color="cyan">{fmt(ev.totalOriginalInputTokens - ev.totalInputTokens)}</Text></Text>;
    case 'L1':
      return <Text><Text color="green">L1</Text> {ev.tool.padEnd(8)} in=<Text color="yellow">{fmt(ev.inputTokens)}</Text>  out=<Text color="green">{fmt(ev.compressedInputTokens)}</Text>  ratio=<Text color="cyan">{(ev.ratio * 100).toFixed(0)}%</Text>  {ev.method === 'truncate' ? <Text color="green">[truncate]</Text> : <Text dimColor>[none]</Text>}</Text>;
    case 'L2':
      return <Text><Text color="green">L2</Text> {ev.file.slice(-20).padEnd(20)} in=<Text color="yellow">{fmt(ev.inputTokens)}</Text>  out=<Text color="green">{fmt(ev.compressedInputTokens)}</Text></Text>;
    case 'L3':
      return <Text><Text color="green">L3</Text> summar  in=<Text color="yellow">{fmt(ev.inputTokens)}</Text>  out=<Text color="green">{fmt(ev.compressedInputTokens)}</Text>  ratio=<Text color="cyan">{(ev.ratio * 100).toFixed(0)}%</Text>  {ev.verified ? <Text color="green">✓</Text> : <Text color="red">✗</Text>}</Text>;
    case 'error':
      return <Text><Text color="red">error</Text>  {ev.layer}  {ev.message.slice(0, 50)}</Text>;
  }
}

export const Live = ({ events }: { events: StatsEvent[] }) => {
  const last = events.slice(-20).reverse();

  if (last.length === 0) {
    return <Text dimColor>Waiting for events...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>Last {last.length} events (newest first, max 100 retained)</Text>
      <Box flexDirection="column" marginTop={1}>
        {last.map((ev, i) => (
          <Text key={i}>
            <Text dimColor>{formatTime(ev.ts)}  </Text>
            {describeEvent(ev)}
          </Text>
        ))}
      </Box>
    </Box>
  );
};
