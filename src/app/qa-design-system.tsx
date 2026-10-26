import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
  Heebo_900Black,
  useFonts,
} from '@expo-google-fonts/heebo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/components/avatar-portrait';
import { colors, fontFamilies, layout, radii, spacing, typeScale } from '@/design/tokens';

const BOARD_CELLS = [
  'dark', 'target', 'target', 'dark',
  'dark', 'me', 'me', 'dark',
  'dark', 'me', 'selected', 'dark',
  'dark', 'dark', 'dark', 'dark',
] as const;

function mergedMeCellStyle(index: number) {
  if (index === 5) return { borderBottomWidth: 0, borderLeftWidth: 0 };
  if (index === 6) return { borderRightWidth: 0 };
  if (index === 9) return { borderTopWidth: 0 };
  return undefined;
}

function TerritoryLabel({ avatar, category, name }: { avatar: string; category: string; name: string }) {
  return (
    <View style={styles.territoryLabel}>
      <Text numberOfLines={1} style={styles.territoryCategory}>{category}</Text>
      <AvatarPortrait avatarId={avatar} borderColor={colors.textPrimary} size={26} />
      <Text numberOfLines={1} style={styles.territoryName}>{name}</Text>
    </View>
  );
}

export default function QaDesignSystemScreen() {
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Heebo_900Black,
  });

  if (!__DEV__) return <Redirect href="/" />;
  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.success} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.kicker}>תצוגה מקדימה · שלב 1</Text>
        <Text style={styles.title}>שפת העיצוב החדשה</Text>
        <Text style={styles.subtitle}>Heebo, ניגודיות גבוהה ומראה של שעשועון טלוויזיה</Text>

        <View style={styles.hud}>
          {['מחזור 3', 'דו־קרבות 6/15', 'שחקנים 10/16'].map((label) => (
            <View key={label} style={styles.chip}><Text style={styles.chipText}>{label}</Text></View>
          ))}
        </View>

        <View style={styles.boardFrame}>
          <View style={styles.board}>
            {BOARD_CELLS.map((state, index) => (
              <View
                key={index}
                style={[
                  styles.cell,
                  state === 'dark' && styles.darkCell,
                  state === 'me' && [styles.meCell, mergedMeCellStyle(index)],
                  state === 'target' && styles.targetCell,
                  state === 'selected' && styles.selectedCell,
                ]}>
                {index === 6 && <TerritoryLabel avatar="avatar-04" category="מוזיקה" name="אתה" />}
                {index === 1 && <TerritoryLabel avatar="avatar-03" category="מדינות" name="נועה" />}
                {index === 2 && <TerritoryLabel avatar="avatar-11" category="ספורט" name="אורי" />}
                {index === 10 && <TerritoryLabel avatar="avatar-05" category="חיות" name="מיכל" />}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.meDot]} /><Text style={styles.legendText}>השטח שלך</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.targetDot]} /><Text style={styles.legendText}>ניתן לתקוף</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.selectedDot]} /><Text style={styles.legendText}>נבחר</Text></View>
        </View>

        <Text style={styles.sectionTitle}>מצבי שעון</Text>
        <View style={styles.clocks}>
          <View style={[styles.clockCard, styles.clockActive]}>
            <Text style={styles.clockLabel}>אתה · תוקף</Text>
            <Text style={styles.clockValue}>34</Text>
          </View>
          <View style={[styles.clockCard, styles.clockDanger]}>
            <Text style={styles.clockLabel}>נועה · מגן</Text>
            <Text style={[styles.clockValue, styles.dangerText]}>05</Text>
            <View style={styles.bonus}><Text style={styles.bonusText}>+5</Text></View>
          </View>
        </View>

        <View style={styles.bottomCard}>
          <Text style={styles.cardEyebrow}>היעד שנבחר</Text>
          <Text style={styles.cardTitle}>חיות · מיכל</Text>
          <Pressable accessibilityRole="button" style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>תקפו את מיכל</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>כפתור משני</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  screen: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  kicker: { color: colors.accentGold, fontFamily: fontFamilies.bold, fontSize: typeScale.caption, textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontFamily: fontFamilies.black, fontSize: typeScale.screenTitle, lineHeight: 36, textAlign: 'center', writingDirection: 'rtl', marginTop: spacing.xs },
  subtitle: { color: colors.textSecondary, fontFamily: fontFamilies.regular, fontSize: typeScale.body, lineHeight: 21, textAlign: 'center', writingDirection: 'rtl', marginTop: spacing.xs },
  hud: { flexDirection: 'row-reverse', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.lg },
  chip: { minHeight: layout.minTouchTarget, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.bold, fontSize: typeScale.caption, writingDirection: 'rtl' },
  boardFrame: { width: '100%', aspectRatio: 1, borderRadius: radii.card, borderWidth: 2, borderColor: colors.boardFrameBorder, backgroundColor: colors.boardFrame, padding: spacing.md, marginTop: spacing.lg, shadowColor: colors.boardFrameBorder, shadowOpacity: 0.35, shadowRadius: 16 },
  board: { flex: 1, flexDirection: 'row-reverse', flexWrap: 'wrap' },
  cell: { width: '25%', height: '25%', alignItems: 'center', justifyContent: 'center' },
  darkCell: { backgroundColor: colors.boardCellDark, borderWidth: 1, borderColor: colors.boardCellDarkBorder },
  meCell: { backgroundColor: colors.territoryMeEnd, borderWidth: 2, borderColor: colors.territoryMeBorder },
  targetCell: { backgroundColor: colors.territoryTarget, borderWidth: 3, borderColor: colors.territoryTargetBorder, shadowColor: colors.territoryTargetBorder, shadowOpacity: 0.9, shadowRadius: 10, zIndex: 2 },
  selectedCell: { backgroundColor: colors.territoryTarget, borderWidth: 3, borderColor: colors.territorySelected, shadowColor: colors.territorySelected, shadowOpacity: 0.95, shadowRadius: 12, zIndex: 3 },
  territoryLabel: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 1, zIndex: 4 },
  territoryCategory: { color: colors.textPrimary, fontFamily: fontFamilies.black, fontSize: 12, lineHeight: 15, textAlign: 'center', writingDirection: 'rtl', textShadowColor: colors.bg, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  territoryName: { color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 15, textAlign: 'center', writingDirection: 'rtl' },
  legend: { flexDirection: 'row-reverse', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  meDot: { backgroundColor: colors.territoryMeEnd },
  targetDot: { backgroundColor: colors.territoryTarget, borderWidth: 2, borderColor: colors.territoryTargetBorder },
  selectedDot: { backgroundColor: colors.territorySelected },
  legendText: { color: colors.textSecondary, fontFamily: fontFamilies.medium, fontSize: typeScale.caption, writingDirection: 'rtl' },
  sectionTitle: { color: colors.textPrimary, fontFamily: fontFamilies.black, fontSize: typeScale.sectionTitle, textAlign: 'right', writingDirection: 'rtl', marginTop: spacing.xl, marginBottom: spacing.sm },
  clocks: { flexDirection: 'row-reverse', gap: spacing.sm },
  clockCard: { flex: 1, minHeight: 126, borderRadius: radii.card, backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  clockActive: { borderWidth: 3, borderColor: colors.success, shadowColor: colors.success, shadowOpacity: 0.6, shadowRadius: 12 },
  clockDanger: { borderColor: colors.danger },
  clockLabel: { color: colors.textSecondary, fontFamily: fontFamilies.bold, fontSize: typeScale.caption, writingDirection: 'rtl' },
  clockValue: { color: colors.textPrimary, fontFamily: fontFamilies.black, fontSize: typeScale.clockActive, lineHeight: 66, fontVariant: ['tabular-nums'], textShadowColor: colors.bg, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  dangerText: { color: colors.danger },
  bonus: { position: 'absolute', top: spacing.sm, left: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.accentGold, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  bonusText: { color: colors.bg, fontFamily: fontFamilies.black, fontSize: typeScale.caption },
  bottomCard: { borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, marginTop: spacing.xl },
  cardEyebrow: { color: colors.accentGold, fontFamily: fontFamilies.bold, fontSize: typeScale.caption, textAlign: 'right', writingDirection: 'rtl' },
  cardTitle: { color: colors.textPrimary, fontFamily: fontFamilies.black, fontSize: typeScale.sectionTitle, textAlign: 'right', writingDirection: 'rtl', marginTop: spacing.xs },
  primaryButton: { minHeight: layout.primaryButtonHeight, borderRadius: radii.button, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  primaryButtonText: { color: colors.bg, fontFamily: fontFamilies.black, fontSize: typeScale.button, writingDirection: 'rtl' },
  secondaryButton: { minHeight: layout.primaryButtonHeight, borderRadius: radii.button, borderWidth: 2, borderColor: colors.accentGold, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  secondaryButtonText: { color: colors.accentGold, fontFamily: fontFamilies.bold, fontSize: typeScale.button, writingDirection: 'rtl' },
});
