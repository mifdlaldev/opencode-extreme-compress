import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Overview } from './views/Overview.js';
import { Models } from './views/Models.js';
import { Sessions } from './views/Sessions.js';
import { Live } from './views/Live.js';
import type { OverallStats, SessionStats, StatsEvent } from './lib/types.js';

interface AppProps {
  overall: OverallStats;
  sessions: SessionStats[];
  liveEvents: StatsEvent[];
  statsPath: string;
  pricing?: { hasAny: boolean };
  onRefresh?: () => void;
}

type View = 'overview' | 'models' | 'sessions' | 'live';

const VIEWS: View[] = ['overview', 'models', 'sessions', 'live'];

function nextView(v: View): View {
  return VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length];
}
function prevView(v: View): View {
  return VIEWS[(VIEWS.indexOf(v) - 1 + VIEWS.length) % VIEWS.length];
}

export const App = ({ overall, sessions, liveEvents, statsPath, pricing, onRefresh }: AppProps) => {
  const [view, setView] = useState<View>('overview');

  useInput((input, key) => {
    if (input === '1') setView('overview');
    else if (input === '2') setView('models');
    else if (input === '3') setView('sessions');
    else if (input === '4') setView('live');
    else if (key.tab && !key.shift) setView(nextView(view));
    else if (key.shift && key.tab) setView(prevView(view));
    else if (input === 'r' && onRefresh) onRefresh();
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">Extreme Compress Monitor</Text>
        <Text dimColor>  │  </Text>
        <Text color={view === 'overview' ? 'green' : undefined}>[1]Overview</Text>
        <Text dimColor>  </Text>
        <Text color={view === 'models' ? 'green' : undefined}>[2]Models</Text>
        <Text dimColor>  </Text>
        <Text color={view === 'sessions' ? 'green' : undefined}>[3]Sessions</Text>
        <Text dimColor>  </Text>
        <Text color={view === 'live' ? 'green' : undefined}>[4]Live</Text>
        <Text dimColor>  │  </Text>
        <Text dimColor>{statsPath}</Text>
        <Text dimColor>  │  </Text>
        <Text dimColor>[r]efresh</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {view === 'overview' && <Overview stats={overall} pricing={pricing ?? { hasAny: false }} />}
        {view === 'models' && <Models byModel={overall.byModel} />}
        {view === 'sessions' && <Sessions sessions={sessions} />}
        {view === 'live' && <Live events={liveEvents} />}
      </Box>
    </Box>
  );
};
