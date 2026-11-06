import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { HomeScreen } from '@/features/home/home-screen';
import { LobbyScreen } from '@/features/lobby/lobby-screen';
import type { HomeTab, LobbyEntry } from '@/game/flow';
import { createMockRoomsSource } from '@/online/mock-rooms-source';

// QA: the new home and the lobby on sample data.
//   /qa-home                     Single tab
//   /qa-home?tab=multi           Multi tab (rooms, podium)
//   /qa-home?tab=multi&state=empty | error | slow   (no rooms and no winners / server offline / slow loading)
//   /qa-home?lobby=host | guest | watch             opens the lobby as host, as a guest or as a spectator
export default function QaHomeScreen() {
  const params = useLocalSearchParams<{ tab?: string; state?: string; lobby?: string }>();
  const [tab, setTab] = useState<HomeTab>(params.tab === 'multi' ? 'multi' : 'single');
  const [entry, setEntry] = useState<LobbyEntry | null>(
    params.lobby
      ? { roomId: 'qa', code: 'K7MQ', name: 'ערב טריוויה', watching: params.lobby === 'watch', isHost: params.lobby === 'host' }
      : null,
  );
  const source = useMemo(
    () => createMockRoomsSource({ empty: params.state === 'empty', fail: params.state === 'error', latencyMs: params.state === 'slow' ? 60_000 : 350 }),
    [params.state],
  );

  if (entry) return <LobbyScreen avatar="avatar-01" entry={entry} nickname="שחקן בדיקה" onBack={() => setEntry(null)} />;
  return (
    <HomeScreen
      avatar="avatar-01"
      nickname="שחקן בדיקה"
      onGuide={() => undefined}
      onNewGame={() => undefined}
      onOpenLobby={setEntry}
      onSignOut={() => undefined}
      onTab={setTab}
      source={source}
      tab={tab}
    />
  );
}
