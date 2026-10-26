import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_BY_ID } from '@/content/categories';
import type { BattleResolution } from '@/game/types';
import { styles } from './battle-transition-styles';

export function BattleOutcomeScreen({
  onComplete,
  resolution,
}: {
  onComplete: () => void;
  resolution: BattleResolution;
}) {
  const winner = resolution.state.players[resolution.winnerId];
  const loser = resolution.state.players[resolution.loserId];
  const category = CATEGORY_BY_ID[winner.categoryId];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${winner.name} ניצח או ניצחה. ${loser.name} הודח או הודחה`);
    const timer = setTimeout(onComplete, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.outcomeScreen}>
        <Text style={styles.outcomeMedal}>🏅</Text>
        <Text style={styles.eyebrow}>הדו־קרב הסתיים</Text>
        <Text style={styles.outcomeTitle}>{winner.name} ניצח/ה!</Text>
        <Text style={styles.outcomeLoser}>{loser.name} הודח/ה מהזירה</Text>
        <View style={[styles.outcomeCategory, { borderColor: winner.color }]}>
          <Text style={styles.outcomeCategoryIcon}>{category.icon}</Text>
          <View style={styles.outcomeCategoryCopy}>
            <Text style={styles.outcomeCategoryLabel}>
              {resolution.inheritedCategory ? 'קטגוריה שנירשה' : 'הקטגוריה שנשמרה'}
            </Text>
            <Text style={styles.outcomeCategoryName}>{category.name}</Text>
          </View>
        </View>
        <Text style={styles.outcomeNext}>מיד עוברים להשתלטות על השטח...</Text>
      </View>
    </SafeAreaView>
  );
}
