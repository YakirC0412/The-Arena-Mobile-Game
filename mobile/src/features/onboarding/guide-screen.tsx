import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/design/app-text';
import { colors, radii, spacing } from '@/design/tokens';

import { GUIDE_PAGES } from './guide-pages';
import { GuideVisual } from './guide-visuals';
import { styles as shared } from './onboarding-styles';

// "How to play": pages with a picture each. Top: home and skip-all. Bottom: back / next and the page dots.
export function GuideScreen({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = GUIDE_PAGES[pageIndex];
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === GUIDE_PAGES.length - 1;

  return (
    <SafeAreaView style={shared.safe}>
      <View style={shared.guideScreen}>
        <View style={shared.guideTopBar}>
          <Pressable
            accessibilityLabel="חזרה למסך הבית"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [local.topButton, pressed && shared.pressed]}>
            <Text style={local.topButtonText} weight="bold">בית</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="דילוג על כל ההסבר"
            accessibilityRole="button"
            onPress={onComplete}
            style={({ pressed }) => [local.topButton, pressed && shared.pressed]}>
            <Text style={local.topButtonText} weight="bold">דילוג על ההסבר</Text>
          </Pressable>
        </View>

        <View style={shared.bookCard}>
          <ScrollView contentContainerStyle={local.cardContent} showsVerticalScrollIndicator={false}>
            <GuideVisual key={page.visual} type={page.visual} />
            <Text style={shared.guideEyebrow}>{`עמוד ${pageIndex + 1} מתוך ${GUIDE_PAGES.length}`}</Text>
            <Text style={shared.guideTitle}>{page.title}</Text>
            <Text style={local.body}>{page.body}</Text>
            <View style={shared.guidePoints}>
              {page.points.map((point, index) => (
                <View key={point} style={shared.guidePointRow}>
                  <View style={shared.pointNumber}>
                    <Text style={shared.pointNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={local.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={shared.guideFooter}>
          <View accessibilityLabel={`עמוד ${pageIndex + 1} מתוך ${GUIDE_PAGES.length}`} style={shared.pageDots}>
            {GUIDE_PAGES.map((item, index) => (
              <Pressable
                accessibilityLabel={`לעמוד ${index + 1}`}
                accessibilityRole="button"
                hitSlop={8}
                key={item.title}
                onPress={() => setPageIndex(index)}
                style={[shared.pageDot, index === pageIndex && shared.pageDotActive]}
              />
            ))}
          </View>
          <View style={local.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isFirstPage }}
              disabled={isFirstPage}
              onPress={() => setPageIndex((current) => current - 1)}
              style={({ pressed }) => [local.navButton, isFirstPage && local.navDisabled, pressed && shared.pressed]}>
              <Text style={local.navText} weight="bold">→ הקודם</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={isLastPage ? onComplete : () => setPageIndex((current) => current + 1)}
              style={({ pressed }) => [shared.primaryButton, local.nextButton, pressed && shared.pressed]}>
              <Text style={shared.primaryButtonText}>{isLastPage ? 'הבנתי, מתחילים' : 'הבא ←'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  topButton: { minHeight: 44, minWidth: 44, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center' },
  topButtonText: { color: colors.textPrimary, fontSize: 14, writingDirection: 'rtl' },
  cardContent: { paddingBottom: spacing.sm },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  pointText: { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  navRow: { flexDirection: 'row-reverse', gap: spacing.sm },
  navButton: { flex: 1, minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  navDisabled: { opacity: 0.35 },
  navText: { color: colors.textPrimary, fontSize: 16, writingDirection: 'rtl' },
  nextButton: { flex: 1.4 },
});
