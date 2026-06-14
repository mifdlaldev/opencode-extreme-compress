#!/usr/bin/env bun
import React, { useState, useEffect } from 'react';
import { render } from 'ink';
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
    return () => { mounted = false; tailer.stop(); };
  }, [statsPath]);

  return <App overall={overall} sessions={sessions} liveEvents={liveEvents} statsPath={statsPath} />;
};

const path = process.argv[2] ?? DEFAULT_STATS_PATH;
render(<Cli statsPath={path} />);
