import React from 'react';
import { Box, Text } from 'ink';
import type { SessionStats } from '../lib/types.js';

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return 'active';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const fmt = (n: number) => n.toLocaleString();

export const Sessions = ({ sessions }: { sessions: SessionStats[] }) => {
  const last30 = sessions.slice(-30).reverse();

  if (last30.length === 0) {
    return <Text dimColor>No sessions recorded yet. Waiting for plugin activity...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>Last {last30.length} of {sessions.length} sessions (newest first)</Text>
      <Box marginTop={1}>
        <Text bold>{'Session ID'.padEnd(14)}</Text>
        <Text bold>{'Model'.padEnd(18)}</Text>
        <Text bold>{'Mode'.padEnd(8)}</Text>
        <Text bold>{'Duration'.padStart(10)}</Text>
        <Text bold>{'Input'.padStart(10)}</Text>
        <Text bold>{'Output'.padStart(10)}</Text>
        <Text bold>{'Saved'.padStart(10)}</Text>
      </Box>
      <Text>{'─'.repeat(82)}</Text>
      {last30.map(s => {
        return (
          <Box key={s.sessionId}>
            <Text>{s.sessionId.slice(0, 12).padEnd(14)}</Text>
            <Text>{s.model.slice(0, 16).padEnd(18)}</Text>
            <Text>{s.mode.padEnd(8)}</Text>
            <Text>{formatDuration(s.durationMs).padStart(10)}</Text>
            <Text color="green">{fmt(s.totalInputTokens).padStart(10)}</Text>
            <Text color="yellow">{fmt(s.totalOutputTokens).padStart(10)}</Text>
            <Text color="cyan">{fmt(s.totalSaved).padStart(10)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
