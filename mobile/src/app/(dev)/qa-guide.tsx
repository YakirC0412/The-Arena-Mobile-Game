import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/design/app-text';
import { colors } from '@/design/tokens';
import { GuideScreen } from '@/features/onboarding/guide-screen';

// The "how to play" pages on their own; the two buttons at the top show what they would do.
export default function QaGuideScreen() {
  const [result, setResult] = useState<string | null>(null);
  if (result) {
    return (
      <View style={styles.result}>
        <AppText style={styles.text} weight="black">{result}</AppText>
      </View>
    );
  }
  return <GuideScreen onBack={() => setResult('חזרה לבית')} onComplete={() => setResult('דילוג על ההסבר / התחלה')} />;
}

const styles = StyleSheet.create({
  result: { flex: 1, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textPrimary, fontSize: 24 },
});
