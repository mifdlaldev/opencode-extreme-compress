import React from 'react';
import { Box, Text } from 'ink';
import type { OverallStats } from '../lib/types.js';

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString();

interface OverviewProps {
  stats: OverallStats;
  pricing: { hasAny: boolean };
}

export const Overview = ({ stats, pricing }: OverviewProps) => {
  const totalSavedPct = stats.totalOriginalInputTokens > 0 ? (stats.avgRatio * 100).toFixed(1) : '0';
  const maxModeSessions = Math.max(...stats.byMode.map(m => m.sessions), 1);
  const maxLayerSaved = Math.max(...stats.byLayer.map(l => l.totalSaved), 1);

  if (stats.totalSessions === 0) {
    return <Text dimColor>No sessions recorded yet. Waiting for plugin activity...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>Sessions: </Text>
        <Text bold color="cyan">{fmt(stats.totalSessions)}</Text>
        <Text>    Input saved: </Text>
        <Text bold color="green">{fmt(stats.totalSaved)}</Text>
        <Text> of {fmt(stats.totalOriginalInputTokens)} ({totalSavedPct}%)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Output: </Text>
        <Text bold color="yellow">{fmt(stats.totalOutputTokens)}</Text>
        <Text dimColor> tokens (estimated from model responses)</Text>
      </Box>

      {pricing.hasAny ? (
        <Box marginBottom={1}>
          <Text>Cost saved: </Text>
          <Text bold color="green">${stats.costSaved.toFixed(4)}</Text>
          <Text>  (was ${stats.costTotalOriginal.toFixed(4)}, now ${stats.costTotal.toFixed(4)} USD)</Text>
          <Text dimColor>  · {stats.modelsWithPricing} model(s) with pricing</Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text dimColor>Cost: no pricing data. Add `pricing` to modelProfiles in extreme-compress.jsonc to see cost.</Text>
        </Box>
      )}

      {stats.actualCost > 0 && (
        <Box marginBottom={1}>
          <Text>Cost paid: </Text>
          <Text bold color="yellow">${stats.actualCost.toFixed(6)}</Text>
          <Text dimColor>  (from LLM provider, exact) · {stats.sessionsWithActualCost} session(s)</Text>
        </Box>
      )}

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
        <Text bold>Layer effectiveness (by tokens saved):</Text>
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
