import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { colors, layout, radii, spacing, typeScale } from '@/design/tokens';
import { CATEGORIES, CATEGORY_BY_ID, getAvailableWays } from '@/content/categories';
import { isPickable } from '@/game/lobby';

const PICKABLE = CATEGORIES.filter((category) => isPickable(category.id));
// 3 columns x 4 rows: a whole page fits on the screen with no scrolling, however many categories exist (search + pages).
const PAGE_SIZE = 12;

// Choose a category: a search field and a paged grid of big tiles. Categories a friend already took are greyed out.
export function CategoryPicker({ mineId, onPick, takenIds }: { mineId: string | null; onPick: (categoryId: string, wayId: 'w1' | 'w2') => void; takenIds: string[] }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  // A category that can be played in two ways asks for the way as a second step.
  const [choosing, setChoosing] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? PICKABLE.filter((category) => category.name.toLowerCase().includes(needle)) : PICKABLE;
  }, [query]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = matches.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  if (choosing) {
    const category = CATEGORY_BY_ID[choosing];
    return (
      <View style={local.wrap}>
        <Text style={local.wayTitle} weight="black">{category.icon} {category.name}</Text>
        <Text style={local.wayHint}>איך תרצו לשחק בקטגוריה הזאת? זו הדרך שבה ישחקו מולכם כשתגנו עליה.</Text>
        {getAvailableWays(category).map((way) => (
          <Pressable
            accessibilityRole="button"
            key={way.id}
            onPress={() => { setChoosing(null); onPick(category.id, way.id as 'w1' | 'w2'); }}
            style={({ pressed }) => [local.wayOption, pressed && local.tilePressed]}>
            <Text style={local.wayLabel} weight="black">{way.label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => setChoosing(null)} style={local.wayBack}>
          <Text style={local.pageButtonText} weight="bold">› חזרה לקטגוריות</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={local.wrap}>
      <TextInput
        accessibilityLabel="חיפוש קטגוריה"
        onChangeText={(value) => { setQuery(value); setPage(0); }}
        placeholder="חיפוש קטגוריה…"
        placeholderTextColor={colors.textSecondary}
        style={local.search}
        value={query}
      />

      <View style={local.grid}>
        {visible.map((category) => {
          const mine = category.id === mineId;
          const taken = !mine && takenIds.includes(category.id);
          return (
            <Pressable
              accessibilityLabel={taken ? `${category.name}, תפוסה` : category.name}
              accessibilityRole="button"
              accessibilityState={{ disabled: taken, selected: mine }}
              disabled={taken}
              key={category.id}
              onPress={() => (getAvailableWays(category).length > 1 ? setChoosing(category.id) : onPick(category.id, 'w1'))}
              style={({ pressed }) => [local.tile, mine && local.tileMine, taken && local.tileTaken, pressed && local.tilePressed]}>
              <Text style={local.icon}>{category.icon}</Text>
              <Text numberOfLines={2} style={local.name} weight={mine ? 'black' : 'bold'}>{category.name}</Text>
              {taken ? <Text style={local.takenText}>תפוסה</Text> : null}
            </Pressable>
          );
        })}
        {matches.length === 0 ? <Text style={local.empty}>לא נמצאה קטגוריה כזאת</Text> : null}
      </View>

      {pages > 1 ? (
        <View style={local.pager}>
          <Pressable accessibilityLabel="העמוד הקודם" accessibilityRole="button" disabled={current === 0} onPress={() => setPage(current - 1)} style={[local.pageButton, current === 0 && local.pageDisabled]}>
            <Text style={local.pageButtonText} weight="bold">הקודם ›</Text>
          </Pressable>
          <Text style={local.pageCount} weight="bold">עמוד {current + 1} מתוך {pages}</Text>
          <Pressable accessibilityLabel="העמוד הבא" accessibilityRole="button" disabled={current >= pages - 1} onPress={() => setPage(current + 1)} style={[local.pageButton, current >= pages - 1 && local.pageDisabled]}>
            <Text style={local.pageButtonText} weight="bold">‹ הבא</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const local = StyleSheet.create({
  wrap: { gap: spacing.md },
  search: { minHeight: 48, borderRadius: radii.control, borderWidth: 1.5, borderColor: colors.brandBorder, backgroundColor: colors.brandNavyDeep, color: colors.textPrimary, fontSize: typeScale.button, paddingHorizontal: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', minHeight: 92, borderRadius: radii.control, borderWidth: 1.5, borderColor: colors.brandBorder, backgroundColor: colors.brandSurface, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  tileMine: { borderColor: colors.brandSky, backgroundColor: colors.brandSkySoft, borderBottomWidth: 4 },
  tileTaken: { opacity: 0.4 },
  tilePressed: { transform: [{ scale: 0.97 }] },
  icon: { fontSize: 28, lineHeight: 34, textAlign: 'center' },
  name: { color: colors.textPrimary, fontSize: 13, lineHeight: 16, textAlign: 'center' },
  takenText: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  empty: { width: '100%', color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center', paddingVertical: spacing.xl },
  wayTitle: { color: colors.textPrimary, fontSize: typeScale.sectionTitle, textAlign: 'center' },
  wayHint: { color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center', lineHeight: 21 },
  wayOption: { minHeight: 64, borderRadius: radii.control, borderWidth: 1.5, borderColor: colors.brandSky, backgroundColor: colors.brandSkySoft, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  wayLabel: { color: colors.textPrimary, fontSize: typeScale.button, textAlign: 'center' },
  wayBack: { minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  pageButton: { minHeight: layout.minTouchTarget, minWidth: 96, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.brandSky, backgroundColor: colors.brandSkySoft, alignItems: 'center', justifyContent: 'center' },
  pageDisabled: { opacity: 0.35 },
  pageButtonText: { color: colors.textPrimary, fontSize: typeScale.body, textAlign: 'center' },
  pageCount: { color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center' },
});
