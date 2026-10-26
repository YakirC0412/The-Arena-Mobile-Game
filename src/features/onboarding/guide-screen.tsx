import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './onboarding-styles';

type GuidePage = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: 'board' | 'neighbors' | 'clock';
};

const GUIDE_PAGES: GuidePage[] = [
  {
    eyebrow: 'עמוד 1 מתוך 3',
    title: 'כבשו את הזירה',
    body: 'הזירה מורכבת מ־16 משבצות. לכל שחקן יש קטגוריית ידע ושטח משלו.',
    points: ['בחרו קטגוריית התמחות', 'נצחו בדו־קרבות', 'השתלטו על כל 16 המשבצות'],
    visual: 'board',
  },
  {
    eyebrow: 'עמוד 2 מתוך 3',
    title: 'בחרו יריב סמוך',
    body: 'בכל תור מוגרל שחקן. השחקן שנבחר יכול לאתגר רק שטח שנוגע בשטח שלו.',
    points: ['אין תקיפה באלכסון', 'נלחמים בקטגוריה של המגן', 'שטח גדול מתנהג כיחידה אחת'],
    visual: 'neighbors',
  },
  {
    eyebrow: 'עמוד 3 מתוך 3',
    title: 'נצחו לפני שהזמן נגמר',
    body: 'לכל שחקן 40 שניות. השעון יורד רק בתורו, עד שניתנת תשובה נכונה.',
    points: ['תשובה נכונה מעבירה את התור', 'דילוג עולה 3 שניות', '3 ניצחונות רצופים מעניקים 5 שניות'],
    visual: 'clock',
  },
];

export function GuideScreen({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = GUIDE_PAGES[pageIndex];
  const isLastPage = pageIndex === GUIDE_PAGES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.guideScreen}>
        <View style={styles.guideTopBar}>
          <Pressable
            accessibilityLabel={pageIndex === 0 ? 'חזרה לבחירת משחק' : 'לעמוד הקודם'}
            accessibilityRole="button"
            onPress={pageIndex === 0 ? onBack : () => setPageIndex((current) => current - 1)}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>→</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onComplete} style={styles.skipGuideButton}>
            <Text style={styles.skipGuideText}>דילוג על ההסבר</Text>
          </Pressable>
        </View>

        <View style={styles.bookCard}>
          <GuideVisual type={page.visual} />
          <Text style={styles.guideEyebrow}>{page.eyebrow}</Text>
          <Text style={styles.guideTitle}>{page.title}</Text>
          <Text style={styles.guideBody}>{page.body}</Text>

          <View style={styles.guidePoints}>
            {page.points.map((point, index) => (
              <View key={point} style={styles.guidePointRow}>
                <View style={styles.pointNumber}>
                  <Text style={styles.pointNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.guidePointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.guideFooter}>
          <View accessibilityLabel={`עמוד ${pageIndex + 1} מתוך ${GUIDE_PAGES.length}`} style={styles.pageDots}>
            {GUIDE_PAGES.map((item, index) => (
              <View
                key={item.title}
                style={[styles.pageDot, index === pageIndex && styles.pageDotActive]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={isLastPage ? onComplete : () => setPageIndex((current) => current + 1)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{isLastPage ? 'הבנתי, מתחילים' : 'לעמוד הבא'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function GuideVisual({ type }: { type: GuidePage['visual'] }) {
  if (type === 'clock') {
    return (
      <View style={styles.guideVisual}>
        <View style={styles.clockRing}>
          <Text style={styles.clockNumber}>40</Text>
          <Text style={styles.clockSeconds}>שניות</Text>
        </View>
        <View style={styles.bonusChip}>
          <Text style={styles.bonusChipText}>+5 בונוס</Text>
        </View>
      </View>
    );
  }

  const highlighted = type === 'neighbors' ? new Set([1, 4, 5, 6, 9]) : new Set([5, 6, 9]);
  return (
    <View style={styles.guideVisual}>
      <View style={styles.miniBoard}>
        {Array.from({ length: 16 }, (_, index) => {
          const isCenter = type === 'neighbors' && index === 5;
          return (
            <View
              key={index}
              style={[
                styles.miniCell,
                highlighted.has(index) && styles.miniCellOwned,
                isCenter && styles.miniCellCenter,
              ]}
            />
          );
        })}
      </View>
      {type === 'neighbors' && <Text style={styles.visualHint}>המשבצות המודגשות זמינות לתקיפה</Text>}
    </View>
  );
}
