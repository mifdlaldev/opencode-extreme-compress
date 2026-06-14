import React from 'react';
import { Box, Text } from 'ink';
import type { ModelStats } from '../lib/types.js';

export const Models = ({ byModel }: { byModel: ModelStats[] }) => {
  if (byModel.length === 0) {
    return <Text dimColor>No model data yet. Waiting for plugin activity...</Text>;
  }

  const fmtTokens = (n: number) => n.toLocaleString();
  const fmtPct = (r: number) => `${(r * 100).toFixed(0)}%`;

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>{'Model'.padEnd(28)}</Text>
        <Text bold>{'Sessions'.padStart(10)}</Text>
        <Text bold>{'Orig'.padStart(14)}</Text>
        <Text bold>{'Saved'.padStart(14)}</Text>
        <Text bold>{'Ratio'.padStart(8)}</Text>
      </Box>
      <Text>{'─'.repeat(76)}</Text>
      {byModel.map(m => (
        <Box key={m.model}>
          <Text>{m.model.padEnd(28)}</Text>
          <Text>{m.sessions.toString().padStart(10)}</Text>
          <Text>{fmtTokens(m.totalOrig).padStart(14)}</Text>
          <Text color="green">{fmtTokens(m.totalSaved).padStart(14)}</Text>
          <Text color="cyan">{fmtPct(m.avgRatio).padStart(8)}</Text>
        </Box>
      ))}
    </Box>
  );
};
