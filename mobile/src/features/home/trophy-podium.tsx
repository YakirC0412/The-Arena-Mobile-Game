import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { colors, radii, spacing } from '@/design/tokens';
import { podiumSlots } from '@/online/format';
import type { LeaderRow } from '@/online/types';
import { styles as homeStyles } from './home-styles';

type Place = 1 | 2 | 3;

// Chunky medal blocks: a bright face, a highlight on top and a darker lower edge, like a toy podium.
const MEDAL: Record<Place, { face: string; edge: string; height: number; avatar: number }> = {
  1: { face: colors.accentGold, edge: colors.podiumGoldEdge, height: 104, avatar: 72 },
  2: { face: colors.podiumSilver, edge: colors.podiumSilverEdge, height: 76, avatar: 60 },
  3: { face: colors.podiumBronze, edge: colors.podiumBronzeEdge, height: 58, avatar: 60 },
};

// The hall of fame: the three players who won the most games. With no winners yet the podium waits, empty, with hourglasses.
export function TrophyPodium({ leaders }: { leaders: LeaderRow[] }) {
  const slots = podiumSlots(leaders);
  return (
    <View accessibilityLabel="היכל התהילה" style={homeStyles.card}>
      <Text accessibilityRole="header" style={local.title} weight="black">🏆 היכל התהילה</Text>
      <View style={local.row}>
        {slots.map(({ leader, place }) => {
          const medal = MEDAL[place];
          const waiting = !leader;
          return (
            <View
              accessibilityLabel={leader ? `מקום ${place}: ${leader.name}, ${leader.wins} ניצחונות` : `מקום ${place}, עדיין פנוי`}
              key={place}
              style={local.slot}>
              <Text style={local.crown}>{place === 1 && leader ? '👑' : ' '}</Text>
              {leader ? (
                <View style={[local.ring, { borderColor: medal.face }]}>
                  <AvatarPortrait avatarId={leader.avatar} borderColor={medal.edge} size={medal.avatar} />
                </View>
              ) : (
                <View style={[local.ring, local.ringEmpty, { width: medal.avatar + 12, height: medal.avatar + 12 }]}>
                  <Text style={local.hourglass}>⏳</Text>
                </View>
              )}
              <View style={local.namePill}>
                <Text numberOfLines={1} style={[local.name, waiting && local.nameWaiting]} weight="bold">{leader ? leader.name : 'ממתין'}</Text>
              </View>
              {leader ? <Text style={[local.wins, { color: medal.face }]} weight="black">🏆 {leader.wins}</Text> : <Text style={local.wins}> </Text>}
              <View style={[local.block, { height: medal.height, backgroundColor: waiting ? colors.brandSurfaceRaised : medal.face, borderBottomColor: waiting ? colors.brandSurface : medal.edge }]}>
                <View style={local.shine} />
                <Text style={[local.number, waiting && local.numberWaiting]} weight="black">{place}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  slot: { flex: 1, alignItems: 'center', gap: 4 },
  crown: { fontSize: 22, lineHeight: 26, textAlign: 'center' },
  ring: { padding: 3, borderRadius: radii.card, borderWidth: 3, backgroundColor: colors.brandNavyDeep },
  ringEmpty: { borderStyle: 'dashed', borderColor: colors.brandBorder, alignItems: 'center', justifyContent: 'center' },
  hourglass: { fontSize: 28, textAlign: 'center' },
  namePill: { maxWidth: '100%', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill, backgroundColor: colors.brandNavyDeep },
  name: { color: colors.textPrimary, fontSize: 13, textAlign: 'center' },
  nameWaiting: { color: colors.textSecondary },
  wins: { fontSize: 14, textAlign: 'center' },
  block: {
    width: '100%',
    borderTopLeftRadius: radii.control,
    borderTopRightRadius: radii.control,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shine: { position: 'absolute', top: 0, left: 0, right: 0, height: 8, backgroundColor: 'rgba(255, 255, 255, 0.35)' },
  number: { color: colors.brandInk, fontSize: 36, lineHeight: 42, textAlign: 'center' },
  numberWaiting: { color: colors.brandBorder },
});
