import { Pressable, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { colors } from '@/design/tokens';
import { describeRoom } from '@/online/format';
import type { RoomSummary } from '@/online/types';
import { styles } from './home-styles';

const ACTION_LABEL = { join: 'הצטרפות', enterCode: 'הכנסת קוד', watch: 'צפייה 👁' } as const;

// One open room: name, host, public / code badge, seats, status, the running-game timer and the one action it offers.
export function RoomCard({ now, onAction, room }: { now: number; onAction: (room: RoomSummary) => void; room: RoomSummary }) {
  const info = describeRoom(room, now);
  const locked = room.visibility === 'private';
  const dotColor = room.phase === 'inGame' ? colors.accentGold : info.full ? colors.brandError : colors.correct;
  return (
    <View
      accessibilityLabel={`${room.name}, ${room.humans} מתוך ${room.maxHumans} שחקנים, ${info.accessLabel}, ${info.statusLabel}`}
      style={styles.roomCard}>
      <View style={styles.roomTop}>
        <View style={[styles.badge, locked && styles.badgeLocked]}>
          <Text style={[styles.badgeText, locked && styles.badgeLockedText]} weight="bold">{locked ? '🔒 ' : '🌐 '}{info.accessLabel}</Text>
        </View>
        <Text numberOfLines={1} style={styles.roomName} weight="bold">{room.name}</Text>
      </View>
      {/* Host and status share one line; the card is two short rows plus the action. */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{info.statusLabel}</Text>
        {info.timer ? <Text style={styles.timer} weight="bold">⏱ {info.timer}</Text> : null}
        <Text style={styles.roomHost}>· מארח: {room.host}{room.watchers > 0 ? ` · ${room.watchers} צופים` : ''}</Text>
      </View>
      <View style={styles.roomBottom}>
        <View style={styles.seatRow}>
          {Array.from({ length: room.maxHumans }, (_, index) => (
            <View key={index} style={[styles.seat, index < room.humans && styles.seatTaken]} />
          ))}
          <Text style={styles.seatCount} weight="bold">{room.humans}/{room.maxHumans}</Text>
        </View>
        {/* Only "open a room" is a solid key; joining is an outline. */}
        <Pressable accessibilityRole="button" onPress={() => onAction(room)} style={[styles.roomAction, styles.roomActionGhost]}>
          <Text style={[styles.roomActionText, styles.roomActionGhostText]} weight="black">{ACTION_LABEL[info.action]}</Text>
        </Pressable>
      </View>
    </View>
  );
}
