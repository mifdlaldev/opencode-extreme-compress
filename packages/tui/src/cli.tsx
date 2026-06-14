#!/usr/bin/env bun
import React, { useState, useEffect, useCallback } from 'react';
import { render, Text, Box } from 'ink';
import { App } from './App.js';
import { readStatsFile } from './lib/stats-reader.js';
import { aggregateOverall, aggregateBySession } from './lib/aggregate.js';
import { StatsTailer } from './lib/stats-tailer.js';
import { loadPricingMap } from './lib/pricing.js';
import type { StatsEvent, SessionStats, OverallStats, Pricing } from './lib/types.js';

const DEFAULT_STATS_PATH = `${process.env.HOME ?? ''}/.config/opencode/extreme-compress-stats.jsonl`;

interface CliProps { statsPath: string; }

const Cli = ({ statsPath }: CliProps) => {
  const [pricingMap, setPricingMap] = useState<Map<string, Pricing>>(new Map());
  const [overall, setOverall] = useState<OverallStats>(() => aggregateOverall([], new Map()));
  const [sessions, setSessions] = useState<SessionStats[]>(() => Array.from(aggregateBySession([], new Map()).values()));
  const [liveEvents, setLiveEvents] = useState<StatsEvent[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [tailerActive, setTailerActive] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const reload = useCallback(async () => {
    try {
      const events = await readStatsFile(statsPath);
      setOverall(aggregateOverall(events, pricingMap));
      setSessions(Array.from(aggregateBySession(events, pricingMap).values()));
      setLiveEvents(events.slice(-100));
    } catch (err) {
      process.stderr.write(`[xtui] reload error: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }, [statsPath, pricingMap]);

  useEffect(() => {
    let mounted = true;
    let allEvents: StatsEvent[] = [];

    (async () => {
      // Load pricing first so it's available for the initial aggregate.
      const pricing = await loadPricingMap();
      if (!mounted) return;
      setPricingMap(pricing);
      process.stderr.write(`[xtui] loaded pricing for ${pricing.size} model(s)\n`);

      const events = await readStatsFile(statsPath);
      if (!mounted) return;
      allEvents = events;
      setOverall(aggregateOverall(events, pricing));
      setSessions(Array.from(aggregateBySession(events, pricing).values()));
      setLiveEvents(events.slice(-100));
      setInitialLoaded(true);
      process.stderr.write(
        `[xtui] loaded ${events.length} event(s) from ${statsPath}\n`
      );

      // Start tailer
      const tailer = new StatsTailer(statsPath);
      tailer.on('event', (ev) => {
        allEvents.push(ev);
        setLiveEvents(allEvents.slice(-100));
        setOverall(aggregateOverall(allEvents, pricing));
        setSessions(Array.from(aggregateBySession(allEvents, pricing).values()));
      });
      tailer.on('error', (err) => {
        process.stderr.write(`[xtui] tailer error: ${err.message}\n`);
      });
      tailer.start();
      setTailerActive(true);

      return () => { tailer.stop(); };
    })();

    return () => { mounted = false; };
  }, [statsPath]);

  if (!initialLoaded) {
    return (
      <Box>
        <Text dimColor>Loading stats from {statsPath}...</Text>
      </Box>
    );
  }

  const hasAnyPricing = pricingMap.size > 0;

  return (
    <App
      overall={overall}
      sessions={sessions}
      liveEvents={liveEvents}
      pricing={{ hasAny: hasAnyPricing }}
      statsPath={`${statsPath}  │  ${tailerActive ? '[live]' : '[stopped]'}`}
      onRefresh={() => { setRefreshTick((n) => n + 1); void reload(); }}
    />
  );
};

const path = process.argv[2] ?? DEFAULT_STATS_PATH;
render(<Cli statsPath={path} />);
