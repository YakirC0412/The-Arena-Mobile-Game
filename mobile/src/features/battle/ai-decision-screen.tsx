import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './battle-transition-styles';

export function AiDecisionScreen({
  canContinue,
  onDecision,
  winnerName,
}: {
  canContinue: boolean;
  onDecision: (continues: boolean) => void;
  winnerName: string;
}) {
  const [choice, setChoice] = useState<boolean | null>(null);

  useEffect(() => {
    const decision = canContinue && Math.random() < 0.38;
    const revealTimer = setTimeout(() => setChoice(decision), 1250);
    const completeTimer = setTimeout(() => onDecision(decision), 2600);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
    };
  }, [canContinue, onDecision]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.decisionScreen}>
        <Text style={styles.eyebrow}>החלטת המנצח</Text>
        <Text style={styles.decisionTitle}>מה {winnerName} יבחר/תבחר?</Text>
        <Text style={styles.decisionBody}>{choice === null ? 'ההחלטה מתקבלת...' : 'הבחירה התקבלה'}</Text>

        <View style={styles.decisionCards}>
          <View style={[styles.decisionCard, choice === true && styles.decisionCardSelected]}>
            <Text style={styles.decisionCardSymbol}>↗</Text>
            <Text style={styles.decisionCardTitle}>להמשיך</Text>
            <Text style={styles.decisionCardBody}>לבחור יריב סמוך נוסף</Text>
          </View>
          <View style={[styles.decisionCard, choice === false && styles.decisionCardSelected]}>
            <Text style={styles.decisionCardSymbol}>⌂</Text>
            <Text style={styles.decisionCardTitle}>לחזור לזירה</Text>
            <Text style={styles.decisionCardBody}>לעבור להגרלה חדשה</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
