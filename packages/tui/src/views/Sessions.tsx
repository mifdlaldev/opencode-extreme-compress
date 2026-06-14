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
        <Text bold>{'Model'.padEnd(22)}</Text>
        <Text bold>{'Mode'.padEnd(10)}</Text>
        <Text bold>{'Duration'.padStart(10)}</Text>
        <Text bold>{'Saved'.padStart(10)}</Text>
        <Text bold>{'Events'.padStart(8)}</Text>
      </Box>
      <Text>{'─'.repeat(76)}</Text>
      {last30.map(s => {
        const eventCount = s.l1Count + s.l2Count + s.l3Count;
        return (
          <Box key={s.sessionId}>
            <Text>{s.sessionId.slice(0, 12).padEnd(14)}</Text>
            <Text>{s.model.slice(0, 20).padEnd(22)}</Text>
            <Text>{s.mode.padEnd(10)}</Text>
            <Text>{formatDuration(s.durationMs).padStart(10)}</Text>
            <Text color="green">{s.totalSaved.toLocaleString().padStart(10)}</Text>
            <Text>{eventCount.toString().padStart(8)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
