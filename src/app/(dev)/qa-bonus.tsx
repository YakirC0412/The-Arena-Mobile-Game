import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BattleIntroScreen } from '@/features/battle/battle-transitions';
import { BattleView } from '@/features/battle/battle-view';
import { BonusEarnedPopup } from '@/features/battle/bonus-earned-popup';
import {
  createBattleSetup,
  createInitialGame,
  getNeighborPlayerIds,
  resolveBattle,
} from '@/game/engine';
import type { BattleResolution } from '@/game/types';

const FIXED_RANDOM = () => 0;
const WEAK_AI_RANDOM = () => 0.99;

function createThreeWinState() {
  let state = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
  for (let win = 0; win < 3; win += 1) {
    const targetId = getNeighborPlayerIds(state, 'human')[0];
    state = resolveBattle(
      state,
      createBattleSetup(state, 'human', targetId),
      'human',
    ).state;
  }
  return state;
}

function createDefensiveThirdWinResult() {
  let state = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
  for (let win = 0; win < 2; win += 1) {
    const targetId = getNeighborPlayerIds(state, 'human')[0];
    state = resolveBattle(state, createBattleSetup(state, 'human', targetId), 'human').state;
  }
  const attackerId = getNeighborPlayerIds(state, 'human')[0];
  return resolveBattle(state, createBattleSetup(state, attackerId, 'human'), 'human');
}

export default function BonusQaScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [resolution, setResolution] = useState<BattleResolution | null>(null);
  const [showEarnedPopup, setShowEarnedPopup] = useState(true);

  const scenario = useMemo(() => {
    const state = createThreeWinState();
    const opponentId = getNeighborPlayerIds(state, 'human')[0];
    const playerDefends = mode === 'defend' || mode === 'intro-defend';
    const setup = playerDefends
      ? createBattleSetup(state, opponentId, 'human')
      : createBattleSetup(state, 'human', opponentId);

    return {
      state,
      setup: {
        ...setup,
        attackerSeconds: playerDefends ? 4 : setup.attackerSeconds,
        defenderSeconds: playerDefends ? setup.defenderSeconds : 4,
      },
    };
  }, [mode]);

  if (mode === 'defender-third') {
    const defensiveResult = createDefensiveThirdWinResult();
    const player = defensiveResult.state.players.human;
    return (
      <SafeAreaView style={styles.resultScreen}>
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>בדיקת ניצחון כמגן</Text>
          <Text style={styles.resultTitle}>הבונוס לא הוענק</Text>
          <Text style={styles.resultBody}>
            רצף ניצחונות בהתקפה: {player.winStreak}/3{`\n`}
            בונוס שמור: {player.bonusReady ? 'כן' : 'לא'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'earned') {
    return (
      <SafeAreaView style={styles.resultScreen}>
        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>ניצחון שלישי הושלם</Text>
          <Text style={styles.resultTitle}>הודעת הבונוס מופיעה מיד</Text>
        </View>
        {showEarnedPopup && (
          <BonusEarnedPopup
            onClose={() => setShowEarnedPopup(false)}
            playerName="שחקן בדיקה"
          />
        )}
      </SafeAreaView>
    );
  }

  if (mode === 'intro-attack' || mode === 'intro-defend') {
    return (
      <BattleIntroScreen
        onComplete={() => {}}
        setup={scenario.setup}
        state={scenario.state}
      />
    );
  }

  if (!resolution) {
    return (
      <SafeAreaView style={styles.battleScreen}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>3 ניצחונות רצופים • בונוס שמור לקרב הזה</Text>
        </View>
        <BattleView
          onComplete={(winnerId) => setResolution(resolveBattle(
            scenario.state,
            scenario.setup,
            winnerId,
          ))}
          random={WEAK_AI_RANDOM}
          setup={scenario.setup}
          state={scenario.state}
        />
      </SafeAreaView>
    );
  }

  const player = resolution.state.players.human;
  return (
    <SafeAreaView style={styles.resultScreen}>
      <View style={styles.resultCard}>
        <Text style={styles.resultEyebrow}>הדו־קרב הסתיים</Text>
        <Text style={styles.resultTitle}>תוצאת הקרב נשמרה</Text>
        <Text style={styles.resultBody}>
          {player.isActive ? 'שחקן בדיקה נשאר בזירה.' : 'שחקן בדיקה הודח מהזירה.'}
        </Text>
        <Pressable onPress={() => setResolution(null)} style={styles.button}>
          <Text style={styles.buttonText}>הפעלת בדיקת הבונוס שוב</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  battleScreen: { flex: 1, backgroundColor: colors.bg },
  statusBar: { backgroundColor: colors.accentGold, paddingVertical: 7, paddingHorizontal: 12 },
  statusText: { color: colors.surfaceMuted, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  resultScreen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  resultCard: { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentGold, padding: 22, alignItems: 'center' },
  resultEyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  resultTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center', writingDirection: 'rtl' },
  resultBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 14, textAlign: 'center', writingDirection: 'rtl' },
  button: { width: '100%', height: 52, borderRadius: 16, backgroundColor: colors.success, marginTop: 18, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
