import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { HomeScreen } from '@/features/home/home-screen';
import { MockLobbyScreen, ServerLobbyScreen } from '@/features/lobby/lobby-screen';
import { createServerRoomsSource } from '@/online/server-rooms-source';
import type { HomeTab, LobbyEntry } from '@/game/flow';
import { createMockRoomsSource } from '@/online/mock-rooms-source';

// QA: the new home and the lobby on sample data.
//   /qa-home                     Single tab
//   /qa-home?tab=multi           Multi tab (rooms, podium)
//   /qa-home?tab=multi&state=empty | error | slow   (no rooms and no winners / server offline / slow loading)
//   /qa-home?lobby=host | guest | watch             opens the lobby as host, as a guest or as a spectator (sample people)
//   /qa-home?server=1&name=דנה                      uses the REAL server for rooms and the lobby (name = nickname, one account per name)
export default function QaHomeScreen() {
  const params = useLocalSearchParams<{ tab?: string; state?: string; lobby?: string; server?: string; name?: string }>();
  const nickname = params.name ?? 'שחקן בדיקה';
  const [tab, setTab] = useState<HomeTab>(params.tab === 'multi' ? 'multi' : 'single');
  const [entry, setEntry] = useState<LobbyEntry | null>(
    params.lobby
      ? { roomId: 'qa', code: 'K7MQ', name: 'ערב טריוויה', watching: params.lobby === 'watch', isHost: params.lobby === 'host' }
      : null,
  );
  const source = useMemo(
    () => params.server ? createServerRoomsSource({ avatar: 'avatar-01', nickname, gender: 'male' }) : createMockRoomsSource({ empty: params.state === 'empty', fail: params.state === 'error', latencyMs: params.state === 'slow' ? 60_000 : 350 }),
    [params.state, params.server],
  );

  if (entry) {
    const Lobby = params.server ? ServerLobbyScreen : MockLobbyScreen;
    return <Lobby avatar="avatar-01" entry={entry} gender="male" nickname={nickname} onBack={() => setEntry(null)} />;
  }
  return (
    <HomeScreen
      avatar="avatar-01"
      nickname={nickname}
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
