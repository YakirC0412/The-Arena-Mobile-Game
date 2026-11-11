import { useState } from 'react';
import { View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { describeRoom } from '@/online/format';
import type { RoomsSource } from '@/online/rooms-source';
import type { RoomSummary } from '@/online/types';
import type { LobbyEntry } from '@/game/flow';
import { HeroLogo } from './hero-logo';
import { styles } from './home-styles';
import { RoomCard } from './room-card';
import { CreateRoomSheet, JoinCodeSheet } from './room-sheets';
import { TrophyPodium } from './trophy-podium';
import { useNow, useRooms } from './use-rooms';

const entryFor = (room: RoomSummary, now: number, isHost = false): LobbyEntry => ({
  roomId: room.id,
  code: room.code,
  name: room.name,
  // A full room or a running game can only be watched.
  watching: room.phase === 'inGame' || room.humans >= room.maxHumans,
  isHost,
  visibility: room.visibility,
});

// Multi play: the hall of fame, open / join-by-code actions and the live list of rooms.
export function HomeMultiTab({ nickname, onOpenLobby, source }: { nickname: string; onOpenLobby: (entry: LobbyEntry) => void; source: RoomsSource }) {
  const { leaders, retry, rooms, status } = useRooms(source);
  const now = useNow(1000);
  const [sheet, setSheet] = useState<'create' | 'code' | null>(null);
  // Rooms you can join come first, then code rooms, then those you can only watch.
  const order = { join: 0, enterCode: 1, watch: 2 } as const;
  const sortedRooms = [...rooms].sort((a, b) => order[describeRoom(a, now).action] - order[describeRoom(b, now).action]);
  // A private waiting room asks for its code first; the same sheet then opens the lobby.
  const onCardAction = (room: RoomSummary) => {
    if (describeRoom(room, now).action === 'enterCode') setSheet('code');
    else onOpenLobby(entryFor(room, now));
  };

  return (
    <>
      {/* The logo beside the two actions: the same game-like front door as the Single tab, in half the height. */}
      <View style={styles.multiHero}>
        <View style={styles.multiActions}>
          <BrandPrimaryButton disabled={status === 'error'} label="פתיחת חדר חדש" onPress={() => setSheet('create')} style={styles.playButton} />
          <BrandSecondaryButton icon="🔑" label="יש לי קוד לחדר" onPress={() => setSheet('code')} />
        </View>
        <HeroLogo maxSize={132} />
      </View>

      <View style={styles.sectionRow}>
        <Text accessibilityRole="header" style={styles.sectionTitle} weight="black">חדרים פתוחים{status === 'ready' ? ` (${rooms.length})` : ''}</Text>
      </View>

      {status === 'loading' ? (
        <View accessibilityLabel="טוען חדרים" style={{ gap: 12 }}>
          <Text style={styles.stateText}>מחפשים חדרים…</Text>
          {[0, 1, 2].map((index) => <View key={index} style={styles.skeleton} />)}
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.card, styles.stateBox]}>
          <Text style={styles.stateIcon}>📡</Text>
          <Text style={styles.stateText}>אין חיבור לחדרים כרגע.{'\n'}נסו שוב בעוד רגע.</Text>
          <BrandSecondaryButton label="נסו שוב" onPress={retry} />
        </View>
      ) : null}

      {status === 'ready' && rooms.length === 0 ? (
        <View style={[styles.card, styles.stateBox]}>
          <Text style={styles.stateText}>אין חדרים פעילים כרגע</Text>
        </View>
      ) : null}

      {status === 'ready' ? sortedRooms.map((room) => <RoomCard key={room.id} now={now} onAction={onCardAction} room={room} />) : null}

      {/* The hall of fame comes after the working content: rooms first, glory second. */}
      {status === 'error' ? null : <TrophyPodium leaders={leaders} />}

      <CreateRoomSheet
        host={nickname}
        onClose={() => setSheet(null)}
        onCreated={(room) => { setSheet(null); onOpenLobby(entryFor(room, now, true)); }}
        source={source}
        visible={sheet === 'create'}
      />
      <JoinCodeSheet
        onClose={() => setSheet(null)}
        onFound={(room) => { setSheet(null); onOpenLobby(entryFor(room, now)); }}
        source={source}
        visible={sheet === 'code'}
      />
    </>
  );
}
