import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES, CATEGORY_BY_ID, getAvailableWays } from '@/content/categories';
import { AppText as Text } from '@/design/app-text';
import { BrandPrimaryButton } from '@/design/brand';
import { colors, layout, radii, spacing, typeScale } from '@/design/tokens';
import type { CategoryLevel, WayId } from '@/game/types';

// Picks the player's category from the 36 (two pages of 18) and, where it has
// two ways, how to play it. Coming-soon categories are shown but locked.
const LISTED = CATEGORIES.filter((category) => category.status !== 'reserve');
const PAGE_SIZE = 18;
const PAGES = [LISTED.slice(0, PAGE_SIZE), LISTED.slice(PAGE_SIZE)];
const LEVEL_LABEL: Record<CategoryLevel, string> = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
const LEVEL_COLOR: Record<CategoryLevel, string> = { easy: colors.correct, medium: colors.warning, hard: colors.danger };

export function SetupScreen({
  onBack,
  onSelect,
  onSelectWay,
  onStart,
  selectedCategoryId,
  selectedWayId,
}: {
  onBack: () => void;
  onSelect: (categoryId: string) => void;
  onSelectWay: (wayId: WayId) => void;
  onStart: () => void;
  selectedCategoryId: string;
  selectedWayId: WayId;
}) {
  const selected = CATEGORY_BY_ID[selectedCategoryId];
  const [page, setPage] = useState(() => Math.max(0, PAGES.findIndex((items) => items.some((item) => item.id === selectedCategoryId))));
  const ways = getAvailableWays(selected);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.topRow}>
          <Pressable accessibilityLabel="חזרה למסך הבית" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>→</Text>
          </Pressable>
          <Text style={styles.eyebrow} weight="bold">משחק חדש</Text>
        </View>
        <Text style={styles.title} weight="black">בחרו את הקטגוריה שלכם</Text>
        <Text style={styles.subtitle}>שאר הזירה תוגרל סביבכם, עם קטגוריות ברמות קושי שונות.</Text>

        <View accessibilityRole="tablist" style={styles.pageTabs}>
          {PAGES.map((items, index) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: page === index }}
              key={index}
              onPress={() => setPage(index)}
              style={[styles.pageTab, page === index && styles.pageTabActive]}>
              <Text style={[styles.pageTabText, page === index && styles.pageTabTextActive]} weight="bold">
                {index === 0 ? `1–${items.length}` : `${PAGE_SIZE + 1}–${PAGE_SIZE + items.length}`}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {PAGES[page].map((category) => {
            const isSelected = category.id === selectedCategoryId;
            const locked = category.status !== 'active';
            return (
              <Pressable
                accessibilityLabel={`${category.name}, ${LEVEL_LABEL[category.level]}${locked ? ', בקרוב' : ''}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: locked }}
                disabled={locked}
                key={category.id}
                onPress={() => onSelect(category.id)}
                style={[styles.tile, isSelected && styles.tileSelected, locked && styles.tileLocked]}>
                <Text style={styles.tileIcon}>{category.icon}</Text>
                <Text numberOfLines={2} style={[styles.tileName, isSelected && styles.tileNameSelected]} weight="bold">
                  {category.name}
                </Text>
                {locked ? (
                  <Text style={styles.soonTag} weight="bold">בקרוב</Text>
                ) : (
                  <View style={styles.levelRow}>
                    <View style={[styles.levelDot, { backgroundColor: LEVEL_COLOR[category.level] }]} />
                    <Text style={styles.levelText}>{LEVEL_LABEL[category.level]}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <Text style={styles.summaryIcon}>{selected.icon}</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel} weight="bold">הקטגוריה שלכם</Text>
              <Text style={styles.summaryName} weight="black">{selected.name}</Text>
            </View>
          </View>

          {ways.length > 1 ? (
            <View accessibilityRole="radiogroup" style={styles.ways}>
              <Text style={styles.waysTitle} weight="bold">איך תרצו לשחק בה?</Text>
              {ways.map((way) => {
                const active = way.id === selectedWayId;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    key={way.id}
                    onPress={() => onSelectWay(way.id)}
                    style={[styles.wayOption, active && styles.wayOptionActive]}>
                    <View style={[styles.radio, active && styles.radioActive]} />
                    <Text style={styles.wayText} weight="bold">{way.label}</Text>
                  </Pressable>
                );
              })}
              <Text style={styles.waysHint}>כשיתקפו אתכם, הדו־קרב ישוחק בדרך שבחרתם.</Text>
            </View>
          ) : (
            <Text style={styles.singleWay}>איך משחקים: {ways[0]?.label}</Text>
          )}

          <BrandPrimaryButton label="כניסה לזירה" onPress={onStart} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: radii.control, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.textPrimary, fontSize: 20, textAlign: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: typeScale.caption },
  title: { color: colors.textPrimary, fontSize: 26, lineHeight: 32 },
  subtitle: { color: colors.textSecondary, fontSize: typeScale.body, marginTop: -spacing.sm },

  pageTabs: { flexDirection: 'row-reverse', alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, padding: 3 },
  pageTab: { minHeight: 36, minWidth: 72, paddingHorizontal: spacing.md, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  pageTabActive: { backgroundColor: colors.success },
  pageTabText: { color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center' },
  pageTabTextActive: { color: colors.bg },

  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31.5%',
    minHeight: 104,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 3,
  },
  tileSelected: { borderColor: colors.success, backgroundColor: colors.surfaceMuted, shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  tileLocked: { opacity: 0.45 },
  tileIcon: { fontSize: 28, lineHeight: 34, textAlign: 'center' },
  tileName: { color: colors.textSecondary, fontSize: typeScale.caption, lineHeight: 16, textAlign: 'center' },
  tileNameSelected: { color: colors.textPrimary },
  levelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  levelDot: { width: 7, height: 7, borderRadius: 4 },
  levelText: { color: colors.textSecondary, fontSize: typeScale.caption, lineHeight: 15 },
  soonTag: { color: colors.textSecondary, fontSize: typeScale.caption, lineHeight: 15, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: 6 },

  summary: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  summaryHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md },
  summaryIcon: { fontSize: 36, lineHeight: 42 },
  summaryText: { flex: 1 },
  summaryLabel: { color: colors.accentGold, fontSize: typeScale.caption },
  summaryName: { color: colors.textPrimary, fontSize: typeScale.sectionTitle },
  ways: { gap: spacing.sm },
  waysTitle: { color: colors.textPrimary, fontSize: typeScale.body },
  wayOption: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.control, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  wayOptionActive: { borderColor: colors.success, backgroundColor: colors.successSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.textSecondary },
  radioActive: { borderColor: colors.success, backgroundColor: colors.success },
  wayText: { color: colors.textPrimary, fontSize: typeScale.body, flex: 1 },
  waysHint: { color: colors.textSecondary, fontSize: typeScale.caption },
  singleWay: { color: colors.textSecondary, fontSize: typeScale.body },
});
