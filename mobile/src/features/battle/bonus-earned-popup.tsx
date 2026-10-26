import { colors } from '@/design/tokens';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';

export function BonusEarnedPopup({
  onClose,
  playerName,
}: {
  onClose: () => void;
  playerName: string;
}) {
  return (
    <View accessibilityViewIsModal style={styles.backdrop}>
      <View accessibilityLiveRegion="assertive" accessible accessibilityLabel={`${playerName} זכה או זכתה בבונוס של חמש שניות`} style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>+5</Text>
        </View>
        <Text style={styles.eyebrow}>שלושה ניצחונות ברציפות!</Text>
        <Text style={styles.title}>{playerName} זכה/תה בבונוס</Text>
        <Text style={styles.body}>
          בקרב הבא יעמדו לרשותו/ה 45 שניות במקום 40 — בין אם יתקוף/תתקוף ובין אם יגן/תגן.
        </Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
          <Text style={styles.buttonText}>מעולה, ממשיכים</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, backgroundColor: colors.overlay, padding: 22, justifyContent: 'center' },
  card: { borderRadius: 28, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accentGold, padding: 24, alignItems: 'center', shadowColor: colors.accentGold, shadowOpacity: 0.4, shadowRadius: 24, elevation: 18 },
  badge: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.accentGold, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  badgeText: { color: colors.bg, fontSize: 34, fontWeight: '900' },
  eyebrow: { color: colors.accentGold, fontSize: 13, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 27, fontWeight: '900', marginTop: 6, textAlign: 'center', writingDirection: 'rtl' },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 12, textAlign: 'center', writingDirection: 'rtl' },
  button: { width: '100%', height: 54, borderRadius: 17, backgroundColor: colors.success, marginTop: 22, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '900', writingDirection: 'rtl' },
});
