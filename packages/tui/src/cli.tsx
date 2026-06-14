#!/usr/bin/env bun
import React, { useState, useEffect, useCallback } from 'react';
import { render, Text, Box } from 'ink';
import { App } from './App.js';
import { readStatsFile } from './lib/stats-reader.js';
import { aggregateOverall, aggregateBySession } from './lib/aggregate.js';
import { StatsTailer } from './lib/stats-tailer.js';
import type { StatsEvent, SessionStats, OverallStats } from './lib/types.js';

const DEFAULT_STATS_PATH = `${process.env.HOME ?? ''}/.config/opencode/extreme-compress-stats.jsonl`;

interface CliProps { statsPath: string; }

const Cli = ({ statsPath }: CliProps) => {
  const [overall, setOverall] = useState<OverallStats>(() => aggregateOverall([]));
  const [sessions, setSessions] = useState<SessionStats[]>(() => Array.from(aggregateBySession([]).values()));
  const [liveEvents, setLiveEvents] = useState<StatsEvent[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [tailerActive, setTailerActive] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const reload = useCallback(async () => {
    try {
      const events = await readStatsFile(statsPath);
      setOverall(aggregateOverall(events));
      setSessions(Array.from(aggregateBySession(events).values()));
      setLiveEvents(events.slice(-100));
    } catch (err) {
      process.stderr.write(`[xtui] reload error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }, [statsPath]);

  useEffect(() => {
    let mounted = true;
    let allEvents: StatsEvent[] = [];

    (async () => {
      const events = await readStatsFile(statsPath);
      if (!mounted) return;
      allEvents = events;
      setOverall(aggregateOverall(events));
      setSessions(Array.from(aggregateBySession(events).values()));
      setLiveEvents(events.slice(-100));
      setInitialLoaded(true);
      process.stderr.write(
        `[xtui] loaded ${events.length} event(s) from ${statsPath}\n`
      );
    })();

    const tailer = new StatsTailer(statsPath);
    tailer.on('event', (ev: StatsEvent) => {
      if (!mounted) return;
      allEvents = [...allEvents, ev];
      setLiveEvents((prev) => [...prev, ev].slice(-100));
      setOverall(aggregateOverall(allEvents));
      setSessions(Array.from(aggregateBySession(allEvents).values()));
    });
    void tailer.start();
    setTailerActive(true);
    return () => { mounted = false; tailer.stop(); setTailerActive(false); };
  }, [statsPath, refreshTick]);

  if (!initialLoaded) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text dimColor>Loading stats from {statsPath}…</Text>
        <Text dimColor>(press Ctrl+C to quit)</Text>
      </Box>
    );
  }

  return (
    <App
      overall={overall}
      sessions={sessions}
      liveEvents={liveEvents}
      statsPath={`${statsPath}  │  ${tailerActive ? '[live]' : '[stopped]'}`}
      onRefresh={() => { setRefreshTick((n) => n + 1); void reload(); }}
    />
  );
};

const path = process.argv[2] ?? DEFAULT_STATS_PATH;
render(<Cli statsPath={path} />);
