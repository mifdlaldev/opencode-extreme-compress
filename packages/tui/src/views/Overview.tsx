import React from 'react';
import { Box, Text } from 'ink';
import type { OverallStats } from '../lib/types.js';

export const Overview = ({ stats }: { stats: OverallStats }) => {
  const totalSavedPct = stats.totalOrig > 0 ? (stats.avgRatio * 100).toFixed(1) : '0';
  const maxModeSessions = Math.max(...stats.byMode.map(m => m.sessions), 1);
  const maxLayerSaved = Math.max(...stats.byLayer.map(l => l.totalSaved), 1);

  if (stats.totalSessions === 0) {
    return <Text dimColor>No sessions recorded yet. Waiting for plugin activity...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>Sessions: </Text>
        <Text bold color="cyan">{stats.totalSessions.toLocaleString()}</Text>
        <Text>    Tokens saved: </Text>
        <Text bold color="green">{stats.totalSaved.toLocaleString()}</Text>
        <Text> ({totalSavedPct}% of {stats.totalOrig.toLocaleString()})</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Mode distribution:</Text>
        {stats.byMode.map(m => {
          const barLen = Math.max(1, Math.floor((m.sessions / maxModeSessions) * 30));
          const bar = '█'.repeat(barLen);
          const pct = ((m.sessions / stats.totalSessions) * 100).toFixed(0);
          return (
            <Text key={m.mode}>
              {'  '}{m.mode.padEnd(10)} <Text color="green">{bar}</Text> {pct}% ({m.sessions} sessions)
            </Text>
          );
        })}
      </Box>

      <Box flexDirection="column">
        <Text bold>Layer effectiveness:</Text>
        {stats.byLayer.map(l => {
          const barLen = Math.max(1, Math.floor((l.totalSaved / maxLayerSaved) * 20));
          const bar = '█'.repeat(barLen);
          const pct = stats.totalSaved > 0 ? ((l.totalSaved / stats.totalSaved) * 100).toFixed(0) : '0';
          const label = l.layer === 'L1' ? 'L1 (tool output)' : l.layer === 'L2' ? 'L2 (file content)' : 'L3 (semantic)';
          return (
            <Text key={l.layer}>
              {'  '}{label.padEnd(20)} <Text color="yellow">{bar}</Text> {pct}% ({l.count} events)
            </Text>
          );
        })}
      </Box>
    </Box>
  );
};
