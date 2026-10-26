import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';

import { BattleIntroScreen } from '@/features/battle/battle-intro-screen';
import { createBattleSetup, createInitialGame, getNeighborPlayerIds } from '@/game/engine';

const FIXED_RANDOM = () => 0.18;

export default function QaAvatarsScreen() {
  const scenario = useMemo(() => {
    const state = createInitialGame('animals', FIXED_RANDOM, 'אלוף הזירה', 'avatar-03');
    const defenderId = getNeighborPlayerIds(state, 'human')[0];
    return { state, setup: createBattleSetup(state, 'human', defenderId) };
  }, []);
  const [started, setStarted] = useState(false);

  if (!started) {
    return <BattleIntroScreen onComplete={() => setStarted(true)} setup={scenario.setup} state={scenario.state} />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>הדו־קרב התחיל</Text>
      <Text style={styles.body}>הכפתור פעל והמעבר לדו־קרב בוצע.</Text>
      <Pressable onPress={() => setStarted(false)} style={styles.button}>
        <Text style={styles.buttonText}>הצגה חוזרת</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', writingDirection: 'rtl' },
  body: { color: colors.textSecondary, fontSize: 14, marginTop: 8, writingDirection: 'rtl' },
  button: { minHeight: 52, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', paddingHorizontal: 24, marginTop: 24 },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
