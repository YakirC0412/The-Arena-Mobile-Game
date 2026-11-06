import { View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { styles } from './home-styles';

// What a player should know before pressing play, all on one screen (from docs/GAME_RULES.md).
const FACTS = [
  { icon: '👥', value: '16', label: 'מתמודדים' },
  { icon: '⏱', value: '40″', label: 'לכל שחקן' },
  { icon: '⚔️', value: '15', label: 'דו־קרבות' },
] as const;

const TIPS = [
  { icon: '🖼', text: 'מזהים את מה שבתמונה ומקלידים את שמו – תשובה נכונה מעבירה את התור.' },
  { icon: '⏭', text: 'תקועים? דילוג עולה 3 שניות מהשעון שלכם.' },
  { icon: '🏆', text: 'המפסיד מודח והשטח שלו עובר למנצח. האחרון שנשאר הוא האלוף.' },
] as const;

// Single play: you against 15 bots.
export function HomeSingleTab({ avatar, nickname, onGuide, onNewGame }: { avatar: string; nickname: string; onGuide: () => void; onNewGame: () => void }) {
  return (
    <>
      <View style={[styles.card, styles.heroCard]}>
        <View style={styles.heroAvatarRing}>
          <AvatarPortrait avatarId={avatar} borderColor={colors.brandSky} size={88} />
        </View>
        <Text accessibilityRole="header" style={styles.heroTitle} weight="black">מוכנים לזירה, {nickname}?</Text>
        <Text style={styles.heroSub}>אתם מול 15 יריבים במשחק טריוויה חזותי. כל יריב בקטגוריה משלו – ורק אחד יוצא אלוף.</Text>
        <View style={styles.chips}>
          {FACTS.map((fact) => (
            <View key={fact.label} style={styles.chip}>
              <Text style={styles.chipIcon}>{fact.icon}</Text>
              <Text style={styles.chipValue} weight="black">{fact.value}</Text>
              <Text style={styles.chipLabel}>{fact.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <BrandPrimaryButton icon="⚔️" label="התחלת משחק חדש" onPress={onNewGame} />
        <BrandSecondaryButton icon="📖" label="הוראות המשחק" onPress={onGuide} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} weight="black">איך זה עובד?</Text>
        {TIPS.map((tip) => (
          <View key={tip.icon} style={styles.tipRow}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
