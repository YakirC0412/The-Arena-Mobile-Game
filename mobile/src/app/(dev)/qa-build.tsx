import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/design/app-text';
import { colors, spacing, typeScale } from '@/design/tokens';
import { ArenaBoard } from '@/features/arena/arena-board';
import { ArenaBuildScreen } from '@/features/arena/arena-build-screen';
import { createInitialGame } from '@/game/engine';

const FIXED_RANDOM = () => 0;

// The build animation, then the main arena board of the same game: your cell must be in the same place in both.
export default function QaBuildScreen() {
  const [built, setBuilt] = useState(false);
  const state = useMemo(() => createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה'), []);

  if (!built) return <ArenaBuildScreen onComplete={() => setBuilt(true)} state={state} />;
  return (
    <SafeAreaView style={styles.screen}>
      <AppText style={styles.title} weight="black">הזירה הראשית</AppText>
      <ArenaBoard meId="human" mode="overview" state={state} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.textPrimary, fontSize: typeScale.sectionTitle, textAlign: 'center' },
});
