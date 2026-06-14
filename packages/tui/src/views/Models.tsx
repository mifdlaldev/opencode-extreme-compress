import React from 'react';
import { Box, Text } from 'ink';
import type { ModelStats } from '../lib/types.js';

const fmt = (n: number) => n.toLocaleString();
const fmtPct = (r: number) => `${(r * 100).toFixed(0)}%`;

export const Models = ({ byModel }: { byModel: ModelStats[] }) => {
  if (byModel.length === 0) {
    return <Text dimColor>No model data yet. Waiting for plugin activity...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>{'Model'.padEnd(28)}</Text>
        <Text bold>{'Sessions'.padStart(10)}</Text>
        <Text bold>{'Input orig'.padStart(12)}</Text>
        <Text bold>{'Input comp'.padStart(12)}</Text>
        <Text bold>{'Saved'.padStart(12)}</Text>
        <Text bold>{'Output'.padStart(12)}</Text>
        <Text bold>{'Ratio'.padStart(8)}</Text>
      </Box>
      <Text>{'─'.repeat(96)}</Text>
      {byModel.map(m => (
        <Box key={m.model}>
          <Text>{m.model.padEnd(28)}</Text>
          <Text>{m.sessions.toString().padStart(10)}</Text>
          <Text>{fmt(m.totalOriginalInputTokens).padStart(12)}</Text>
          <Text color="green">{fmt(m.totalInputTokens).padStart(12)}</Text>
          <Text color="green">{fmt(m.totalSaved).padStart(12)}</Text>
          <Text color="yellow">{fmt(m.totalOutputTokens).padStart(12)}</Text>
          <Text color="cyan">{fmtPct(m.avgRatio).padStart(8)}</Text>
        </Box>
      ))}
    </Box>
  );
};
