import { View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { colors } from '@/design/tokens';
import { podiumSlots } from '@/online/format';
import type { LeaderRow } from '@/online/types';
import { styles } from './home-styles';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;
const PEDESTAL_HEIGHT = { 1: 84, 2: 60, 3: 44 } as const;
const AVATAR_SIZE = { 1: 68, 2: 56, 3: 56 } as const;

// The hall of fame: a trophy header and a podium with the three players who won the most games.
export function TrophyPodium({ leaders }: { leaders: LeaderRow[] }) {
  const slots = podiumSlots(leaders);
  return (
    <View accessibilityLabel="היכל התהילה" style={styles.card}>
      <View style={styles.hallHeader}>
        <Text style={styles.hallTrophy}>🏆</Text>
        <View>
          <Text style={styles.cardTitle} weight="black">היכל התהילה</Text>
          <Text style={styles.liveText}>הזוכים הגדולים – מנצחים משחקים מול שחקנים אחרים</Text>
        </View>
      </View>
      <View style={styles.podium}>
        {slots.map(({ leader, place }) => (
          <View
            accessibilityLabel={leader ? `מקום ${place}: ${leader.name}, ${leader.wins} ניצחונות` : `מקום ${place} פנוי`}
            key={place}
            style={styles.podiumSlot}>
            <Text style={styles.podiumMedal}>{MEDALS[place]}</Text>
            {leader ? (
              <AvatarPortrait avatarId={leader.avatar} borderColor={place === 1 ? colors.accentGold : colors.brandSky} size={AVATAR_SIZE[place]} />
            ) : (
              <View style={[styles.podiumEmptyAvatar, { width: AVATAR_SIZE[place], height: AVATAR_SIZE[place], borderRadius: 14 }]}>
                <Text style={styles.podiumEmptyMark}>?</Text>
              </View>
            )}
            <Text numberOfLines={1} style={styles.podiumName} weight="bold">{leader ? leader.name : 'פנוי'}</Text>
            <Text style={styles.podiumWins}>{leader ? `${leader.wins} ניצחונות` : 'מחכה לאלוף'}</Text>
            <View style={[styles.pedestal, place === 1 && styles.pedestalFirst, { height: PEDESTAL_HEIGHT[place] }]}>
              <Text style={[styles.pedestalNumber, place === 1 && styles.pedestalNumberFirst]} weight="black">{place}</Text>
            </View>
          </View>
        ))}
      </View>
      {leaders.length === 0 ? <Text style={styles.hallEmpty}>עוד אין זוכים – נצחו משחק מול חברים ותעלו לפודיום</Text> : null}
    </View>
  );
}
