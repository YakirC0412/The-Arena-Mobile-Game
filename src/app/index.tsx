import { colors } from '@/design/tokens';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
View,
} from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArenaBoard } from '@/components/arena-board';
import { ArenaBuildScreen } from '@/components/arena-build-screen';
import { BattleView } from '@/components/battle-view';
import { BonusEarnedPopup } from '@/components/bonus-earned-popup';
import { ChampionCelebrationScreen } from '@/components/champion-celebration-screen';
import {
  AiBattleSimulationScreen,
  AiDecisionScreen,
  AiTargetSelectionScreen,
  BattleIntroScreen,
  BattleOutcomeScreen,
  ConquestAnimationScreen,
} from '@/components/battle-transitions';
import { DrawAnimationScreen } from '@/components/draw-animation-screen';
import { GameOverScreen } from '@/components/game-over-screen';
import { FinalCategoryScreen } from '@/components/final-category-screen';
import { FinalRevealScreen } from '@/components/final-reveal-screen';
import {
  AuthScreen,
  GameModeScreen,
  GuideScreen,
  type PlayerProfile,
  WelcomeScreen,
} from '@/components/onboarding';
import { CATEGORIES, CATEGORY_BY_ID } from '@/game/content';
import { DEFAULT_AVATAR_ID } from '@/game/avatars';
import {
  chooseAiTarget,
  createFinalBattleSetup,
  createBattleSetup,
  createInitialGame,
  drawPlayer,
  getChampion,
  getFinalCategoryChooser,
  getNeighborPlayerIds,
  getRoundProgress,
  resolveBattle,
  simulateAiBattle,
} from '@/game/engine';
import type { BattleResolution, BattleSetup, GameState } from '@/game/types';

type Screen = 'welcome' | 'auth' | 'mode' | 'guide' | 'setup' | 'building' | 'arena' | 'draw' | 'selection' | 'aiBattle' | 'battle' | 'outcome' | 'conquest' | 'result' | 'decision' | 'aiTarget' | 'finalReveal' | 'finalCategory' | 'victory' | 'gameover';

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [profile, setProfile] = useState<PlayerProfile>({ fullName: '', nickname: '', avatar: DEFAULT_AVATAR_ID });
  const [selectedCategoryId, setSelectedCategoryId] = useState('animals');
  const [game, setGame] = useState<GameState | null>(null);
  const [battle, setBattle] = useState<BattleSetup | null>(null);
  const [battleOrigin, setBattleOrigin] = useState<GameState | null>(null);
  const [aiWinnerId, setAiWinnerId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<BattleResolution | null>(null);
  const [aiTargetId, setAiTargetId] = useState<string | null>(null);
  const [selectingTarget, setSelectingTarget] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [battleNumber, setBattleNumber] = useState(0);

  const startGame = () => {
    setGame(createInitialGame(selectedCategoryId, Math.random, profile.nickname || 'אני', profile.avatar));
    setScreen('building');
    setSelectingTarget(false);
    setBattle(null);
    setBattleOrigin(null);
    setAiWinnerId(null);
    setResolution(null);
    setAiTargetId(null);
    setSelectedTargetId(null);
    setBattleNumber(0);
  };

  const launchBattle = useCallback((state: GameState, attackerId: string, defenderId: string) => {
    const setup = createBattleSetup(state, attackerId, defenderId);
    setGame(state);
    setBattle(setup);
    setBattleOrigin(state);
    setAiWinnerId(null);
    setSelectingTarget(false);
    setSelectedTargetId(null);
    setBattleNumber((current) => current + 1);
    setScreen('selection');
  }, []);

  const beginPreparedBattle = useCallback(() => {
    if (!game || !battle) return;
    const attacker = game.players[battle.attackerId];
    const defender = game.players[battle.defenderId];
    if (attacker.isHuman || defender.isHuman) {
      setScreen('battle');
      return;
    }
    setAiWinnerId(simulateAiBattle(game, battle));
    setScreen('aiBattle');
  }, [battle, game]);

  const resolvePreparedBattle = useCallback((winnerId: string) => {
    if (!battleOrigin || !battle) return;
    const result = resolveBattle(battleOrigin, battle, winnerId);
    setGame(result.state);
    setResolution(result);
    setScreen('outcome');
  }, [battle, battleOrigin]);

  const handleDraw = () => {
    if (!game) return;
    const next = drawPlayer(game);
    setGame(next);
    setSelectingTarget(false);
    setScreen('draw');
  };

  const finishDraw = useCallback(() => {
    if (!game?.selectedPlayerId) return;
    const selected = game.players[game.selectedPlayerId];
    if (selected.isHuman) {
      setSelectingTarget(true);
      setSelectedTargetId(null);
      setScreen('arena');
      return;
    }

    const targetId = chooseAiTarget(game, selected.id);
    if (targetId) {
      setAiTargetId(targetId);
      setResolution(null);
      setScreen('aiTarget');
    }
    else setScreen('gameover');
  }, [game]);

  const chooseTarget = (defenderId: string) => {
    setSelectedTargetId(defenderId);
  };

  const confirmTarget = () => {
    if (!game?.selectedPlayerId || !selectedTargetId) return;
    launchBattle(game, game.selectedPlayerId, selectedTargetId);
  };

  const finishInteractiveBattle = useCallback((winnerId: string) => {
    resolvePreparedBattle(winnerId);
  }, [resolvePreparedBattle]);

  const returnToArena = () => {
    if (!game) return;
    setGame({ ...game, selectedPlayerId: null });
    setResolution(null);
    setBattle(null);
    setBattleOrigin(null);
    setAiWinnerId(null);
    setAiTargetId(null);
    setSelectedTargetId(null);
    setSelectingTarget(false);
    setScreen('arena');
  };

  const continueWinner = () => {
    if (!game || !resolution) return;
    if (!game.players[game.humanPlayerId].isActive) {
      setScreen('gameover');
      return;
    }
    const winner = game.players[resolution.winnerId];
    const targets = getNeighborPlayerIds(game, winner.id);
    if (targets.length === 0) {
      setScreen('gameover');
      return;
    }

    if (winner.isHuman) {
      setGame({ ...game, selectedPlayerId: winner.id });
      setSelectingTarget(true);
      setSelectedTargetId(null);
      setResolution(null);
      setBattle(null);
      setScreen('arena');
      return;
    }

    setScreen('decision');
  };

  const finishAiDecision = (continues: boolean) => {
    if (!game || !resolution) return;
    const winner = game.players[resolution.winnerId];
    if (!continues) {
      returnToArena();
      return;
    }
    const target = chooseAiTarget(game, winner.id);
    if (target) {
      setAiTargetId(target);
      setScreen('aiTarget');
    }
    else returnToArena();
  };

  const selectFinalCategory = (categoryId: string) => {
    if (!game) return;
    const chooser = getFinalCategoryChooser(game);
    if (!chooser) return;
    const setup = createFinalBattleSetup(game, chooser.id, categoryId);
    setBattle(setup);
    setBattleOrigin(game);
    setAiWinnerId(null);
    setResolution(null);
    setAiTargetId(null);
    setBattleNumber((current) => current + 1);
    setScreen('selection');
  };

  if (screen === 'welcome') {
    return <WelcomeScreen onContinue={() => setScreen('auth')} />;
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        initialProfile={profile}
        onBack={() => setScreen('welcome')}
        onComplete={(nextProfile) => {
          setProfile(nextProfile);
          setScreen('mode');
        }}
      />
    );
  }

  if (screen === 'mode') {
    return (
      <GameModeScreen
        nickname={profile.nickname}
        onBack={() => setScreen('auth')}
        onComputer={() => setScreen('guide')}
      />
    );
  }

  if (screen === 'guide') {
    return (
      <GuideScreen
        onBack={() => setScreen('mode')}
        onComplete={() => setScreen('setup')}
      />
    );
  }

  if (screen === 'setup') {
    return (
      <SetupScreen
        onSelect={setSelectedCategoryId}
        onBack={() => setScreen('mode')}
        onStart={startGame}
        selectedCategoryId={selectedCategoryId}
      />
    );
  }

  if (!game) return null;

  if (screen === 'building') {
    return <ArenaBuildScreen onComplete={() => setScreen('arena')} state={game} />;
  }

  if (screen === 'draw') {
    return <DrawAnimationScreen onComplete={finishDraw} state={game} />;
  }

  if (screen === 'selection' && battle) {
    return <BattleIntroScreen battleNumber={battleNumber} onComplete={beginPreparedBattle} setup={battle} state={game} />;
  }

  if (screen === 'aiBattle' && battle && aiWinnerId) {
    return (
      <AiBattleSimulationScreen
        onComplete={resolvePreparedBattle}
        setup={battle}
        state={game}
        winnerId={aiWinnerId}
      />
    );
  }

  if (screen === 'battle' && battle) {
    return (
      <SafeAreaView style={styles.safe}>
        <BattleView onComplete={finishInteractiveBattle} setup={battle} state={game} />
      </SafeAreaView>
    );
  }

  if (screen === 'outcome' && resolution) {
    return (
      <BattleOutcomeScreen
        onComplete={() => setScreen(getChampion(game) ? 'victory' : 'conquest')}
        resolution={resolution}
      />
    );
  }

  if (screen === 'victory' && battleOrigin && resolution) {
    return (
      <ChampionCelebrationScreen
        beforeState={battleOrigin}
        onComplete={() => setScreen('setup')}
        resolution={resolution}
      />
    );
  }

  if (screen === 'conquest' && battleOrigin && resolution) {
    return (
      <ConquestAnimationScreen
        beforeState={battleOrigin}
        onComplete={() => {
          if (getFinalCategoryChooser(game)) setScreen('finalReveal');
          else setScreen('result');
        }}
        resolution={resolution}
      />
    );
  }

  if (screen === 'result' && resolution) {
    const winner = game.players[resolution.winnerId];
    const canContinue = getNeighborPlayerIds(game, winner.id).length > 0;
    return (
      <ResultScreen
        canContinue={canContinue}
        onContinue={continueWinner}
        onReturn={returnToArena}
        resolution={resolution}
        state={game}
      />
    );
  }

  if (screen === 'decision' && resolution) {
    const winner = game.players[resolution.winnerId];
    return (
      <AiDecisionScreen
        canContinue={getNeighborPlayerIds(game, winner.id).length > 0}
        onDecision={finishAiDecision}
        winnerName={winner.name}
      />
    );
  }

  if (screen === 'aiTarget' && aiTargetId) {
    const chooserId = resolution?.winnerId ?? game.selectedPlayerId;
    const winner = chooserId ? game.players[chooserId] : null;
    if (!winner) return null;
    return (
      <AiTargetSelectionScreen
        onComplete={(targetId) => launchBattle(game, winner.id, targetId)}
        state={game}
        targetId={aiTargetId}
        winnerId={winner.id}
      />
    );
  }

  if (screen === 'finalCategory') {
    const chooser = getFinalCategoryChooser(game);
    if (chooser) {
      return (
        <FinalCategoryScreen
          chooserId={chooser.id}
          onSelect={selectFinalCategory}
          state={game}
        />
      );
    }
  }

  if (screen === 'finalReveal') {
    return <FinalRevealScreen onComplete={() => setScreen('finalCategory')} state={game} />;
  }

  if (screen === 'gameover') {
    return <GameOverScreen onRestart={() => setScreen('setup')} state={game} />;
  }

  const human = game.players[game.humanPlayerId];
  const targetIds = selectingTarget && game.selectedPlayerId
    ? getNeighborPlayerIds(game, game.selectedPlayerId)
    : [];
  const selected = game.selectedPlayerId ? game.players[game.selectedPlayerId] : null;
  const selectedTarget = selectedTargetId ? game.players[selectedTargetId] : null;
  const selectedTargetCategory = selectedTarget
    ? CATEGORY_BY_ID[selectedTarget.categoryId]
    : null;
  const roundProgress = getRoundProgress(game);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.arenaScreen}>
        <View style={styles.arenaHeader}>
          <Text style={styles.logo}>THE ARENA</Text>
          <Text style={styles.arenaHeaderSubtitle}>הזירה שלך</Text>
        </View>

        <View style={styles.hudRow}>
          <View style={styles.hudChip}>
            <Text style={styles.hudChipLabel}>סבב</Text>
            <Text style={styles.hudChipValue}>{game.round}</Text>
            <Text style={styles.hudChipMeta}>{roundProgress.drawn}/{roundProgress.total} הוגרלו</Text>
          </View>
          <View style={[styles.hudChip, styles.hudChipPrimary]}>
            <Text style={styles.hudChipLabel}>השטח שלי</Text>
            <Text style={styles.hudChipValue}>{human.cellIds.length} משבצות</Text>
            <Text style={styles.hudChipMeta}>{CATEGORY_BY_ID[human.categoryId].name}</Text>
          </View>
          <View style={[styles.hudChip, human.bonusReady && styles.hudChipBonus]}>
            <Text style={styles.hudChipLabel}>{human.bonusReady ? 'בונוס' : 'רצף'}</Text>
            <Text style={styles.hudChipValue}>{human.bonusReady ? '+5' : `${human.winStreak}/3`}</Text>
            <Text style={styles.hudChipMeta}>{human.bonusReady ? 'מוכן לקרב' : 'ניצחונות'}</Text>
          </View>
        </View>

        <ArenaBoard
          meId={selectingTarget ? game.selectedPlayerId : game.humanPlayerId}
          mode={selectingTarget ? 'select-target' : 'overview'}
          onSelectTarget={chooseTarget}
          selectedId={selectedTargetId}
          state={game}
          targetIds={targetIds}
        />

        {selectingTarget ? (
          <View style={styles.arenaLegend}>
            <View style={styles.arenaLegendItem}>
              <View style={[styles.arenaLegendDot, styles.arenaLegendMe]} />
              <Text style={styles.arenaLegendText}>השטח שלך</Text>
            </View>
            <View style={styles.arenaLegendItem}>
              <View style={[styles.arenaLegendDot, styles.arenaLegendTarget]} />
              <Text style={styles.arenaLegendText}>ניתן לתקוף</Text>
            </View>
          </View>
        ) : null}

        {selectingTarget ? (
          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>בחרו יריב להתקפה</Text>
            {selectedTarget && selectedTargetCategory ? (
              <View style={styles.targetSummary}>
                <Text style={styles.targetCategory}>{selectedTargetCategory.name}</Text>
                <Text style={styles.targetName}>{selectedTarget.name} · {selectedTarget.cellIds.length} משבצות</Text>
              </View>
            ) : (
              <Text style={styles.targetHint}>בחרו שטח זוהר בזירה</Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={!selectedTarget}
              onPress={confirmTarget}
              style={[styles.confirmTargetButton, !selectedTarget && styles.confirmTargetButtonDisabled]}>
              <Text style={styles.confirmTargetButtonText}>
                {selectedTarget ? `תקפו את ${selectedTarget.name}` : 'בחרו יעד בזירה'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.instructionCard}>
              <Text style={styles.instructionTitle}>
                {selected ? `${selected.name} נבחר/ה לשחק` : 'הזירה ממתינה להגרלה'}
              </Text>
              <Text style={styles.instructionText}>{game.events[0]?.text}</Text>
            </View>
            <Pressable accessibilityLabel="הגרלת מתמודד" onPress={handleDraw} style={styles.drawButton}>
              <Text style={styles.drawButtonIcon}>🎲</Text>
            </Pressable>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function SetupScreen({
  onBack,
  onSelect,
  onStart,
  selectedCategoryId,
}: {
  onBack: () => void;
  onSelect: (categoryId: string) => void;
  onStart: () => void;
  selectedCategoryId: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.setupScreen}>
        <Pressable accessibilityLabel="חזרה לבחירת משחק" onPress={onBack} style={styles.setupBackButton}>
          <Text style={styles.setupBackText}>→</Text>
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>המשחק מתחיל כאן</Text>
          <Text style={styles.heroTitle}>THE ARENA</Text>
          <Text style={styles.heroHebrew}>הזירה</Text>
          <Text style={styles.heroBody}>בחרו את קטגוריית ההתמחות שלכם וכבשו את כל 16 המשבצות.</Text>
        </View>

        <Text style={styles.sectionTitle}>בחירת קטגוריה</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category) => {
            const selected = selectedCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => onSelect(category.id)}
                style={[styles.categoryCard, selected && styles.categoryCardSelected]}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={[styles.categoryName, selected && styles.categoryNameSelected]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.prototypeNote}>
          <Text style={styles.prototypeNoteTitle}>גרסת אבטיפוס</Text>
          <Text style={styles.prototypeNoteText}>
            התמונות מיוצגות כרגע באיורים מובנים. מאגר התמונות המלא יתווסף לאחר אימות המשחקיות.
          </Text>
        </View>

        <Pressable onPress={onStart} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>כניסה לזירה</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultScreen({
  canContinue,
  onContinue,
  onReturn,
  resolution,
  state,
}: {
  canContinue: boolean;
  onContinue: () => void;
  onReturn: () => void;
  resolution: BattleResolution;
  state: GameState;
}) {
  const winner = state.players[resolution.winnerId];
  const category = CATEGORY_BY_ID[winner.categoryId];
  const [showBonusPopup, setShowBonusPopup] = useState(resolution.winnerEarnedBonus);
  const [showArenaPreview, setShowArenaPreview] = useState(false);
  const availableTargetIds = getNeighborPlayerIds(state, winner.id);
  return (
    <SafeAreaView style={styles.resultScreen}>
      <Text style={styles.resultIcon}>🏅</Text>
      <Text style={styles.resultEyebrow}>ניצחון בדו־קרב</Text>
      <Text style={styles.resultTitle}>{winner.name} ניצח/ה</Text>
      <Text style={styles.resultSummary}>{resolution.summary}</Text>

      <View style={styles.resultStats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{winner.cellIds.length}</Text>
          <Text style={styles.statLabel}>משבצות בשטח</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{category.icon}</Text>
          <Text style={styles.statLabel}>{category.name}</Text>
        </View>
      </View>

      {winner.isHuman ? (
        <View style={styles.resultActions}>
          <Pressable
            accessibilityLabel="הצצה לזירה וליריבים הזמינים"
            onHoverIn={() => setShowArenaPreview(true)}
            onHoverOut={() => setShowArenaPreview(false)}
            onPress={() => setShowArenaPreview((visible) => !visible)}
            style={styles.arenaPeekArea}>
            <View style={styles.arenaPeekButton}>
              <Text style={styles.arenaPeekIcon}>▦</Text>
            </View>
            {showArenaPreview && (
              <View style={styles.arenaPeekPanel}>
                <Text style={styles.arenaPeekTitle}>יריבים סמוכים שניתן לתקוף</Text>
                <ArenaBoard
                  meId={winner.id}
                  mode="select-target"
                  state={state}
                  targetIds={availableTargetIds}
                />
              </View>
            )}
          </Pressable>
          {canContinue && (
            <Pressable onPress={onContinue} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>להמשיך ולתקוף</Text>
            </Pressable>
          )}
          <Pressable onPress={onReturn} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>לחזור לזירה</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onContinue} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>המשך</Text>
        </Pressable>
      )}

      {showBonusPopup && (
        <BonusEarnedPopup
          onClose={() => setShowBonusPopup(false)}
          playerName={winner.name}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  setupScreen: { padding: 20, paddingBottom: 40 },
  setupBackButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  setupBackText: { color: colors.textPrimary, fontSize: 21, fontWeight: '900' },
  hero: { alignItems: 'center', paddingVertical: 22 },
  heroKicker: { color: colors.accentGold, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.textPrimary, fontSize: 38, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  heroHebrew: { color: colors.success, fontSize: 24, fontWeight: '900', marginTop: -4 },
  heroBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', writingDirection: 'rtl', marginTop: 12, maxWidth: 320 },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 },
  categoryGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  categoryCard: { width: '22.5%', minHeight: 86, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.surface, justifyContent: 'center', alignItems: 'center', padding: 7 },
  categoryCardSelected: { backgroundColor: colors.surface, borderColor: colors.success },
  categoryIcon: { fontSize: 29 },
  categoryName: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
  categoryNameSelected: { color: colors.textPrimary },
  prototypeNote: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginVertical: 18, borderRightWidth: 4, borderRightColor: colors.accentGold },
  prototypeNoteTitle: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  prototypeNoteText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl', marginTop: 3 },
  primaryButton: { minHeight: 54, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: colors.bg, fontSize: 16, fontWeight: '900', writingDirection: 'rtl' },
  secondaryButton: { minHeight: 52, borderRadius: 18, borderWidth: 1.5, borderColor: colors.textSecondary, justifyContent: 'center', alignItems: 'center' },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', writingDirection: 'rtl' },
  arenaScreen: { padding: 18, paddingBottom: 32 },
  arenaHeader: { alignItems: 'center', marginBottom: 12 },
  logo: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  arenaHeaderSubtitle: { color: colors.accentGold, fontSize: 13, fontWeight: '900', marginTop: 1, writingDirection: 'rtl' },
  hudRow: { flexDirection: 'row-reverse', gap: 7, marginBottom: 14 },
  hudChip: { flex: 1, minHeight: 70, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 7 },
  hudChipPrimary: { borderColor: colors.success },
  hudChipBonus: { borderColor: colors.accentGold },
  hudChipLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  hudChipValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', writingDirection: 'rtl', marginTop: 1 },
  hudChipMeta: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', writingDirection: 'rtl', marginTop: 1 },
  arenaLegend: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 24, marginTop: 12 },
  arenaLegendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  arenaLegendDot: { width: 16, height: 16, borderRadius: 4 },
  arenaLegendMe: { backgroundColor: colors.territoryMeEnd, borderWidth: 1, borderColor: colors.territoryMeBorder },
  arenaLegendTarget: { backgroundColor: colors.territoryTarget, borderWidth: 2, borderColor: colors.territoryTargetBorder },
  arenaLegendText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', writingDirection: 'rtl' },
  instructionCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginTop: 14, marginBottom: 12 },
  instructionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  instructionText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl', marginTop: 3 },
  targetCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: colors.border },
  targetCardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  targetSummary: { alignItems: 'center', marginTop: 10, marginBottom: 14 },
  targetCategory: { color: colors.accentGold, fontSize: 21, fontWeight: '900', writingDirection: 'rtl' },
  targetName: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', writingDirection: 'rtl', marginTop: 2 },
  targetHint: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl', marginVertical: 15 },
  confirmTargetButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  confirmTargetButtonDisabled: { opacity: 0.38 },
  confirmTargetButtonText: { color: colors.bg, fontSize: 16, fontWeight: '900', writingDirection: 'rtl' },
  drawButton: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.territoryMeBorder, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', shadowColor: colors.success, shadowOpacity: 0.55, shadowRadius: 12, elevation: 8 },
  drawButtonIcon: { fontSize: 31, lineHeight: 38 },
  resultScreen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
  resultIcon: { fontSize: 66, textAlign: 'center' },
  resultEyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 8 },
  resultTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
  resultSummary: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center', writingDirection: 'rtl', marginVertical: 16 },
  resultStats: { flexDirection: 'row-reverse', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minHeight: 86, borderRadius: 18, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', padding: 10 },
  statValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '900' },
  statLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl', marginTop: 2 },
  resultActions: { gap: 10, position: 'relative', zIndex: 10 },
  arenaPeekArea: { width: '100%', minHeight: 54, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  arenaPeekButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.success, justifyContent: 'center', alignItems: 'center' },
  arenaPeekIcon: { color: colors.textPrimary, fontSize: 31, lineHeight: 34, fontWeight: '900' },
  arenaPeekPanel: { position: 'absolute', left: 0, right: 0, bottom: 58, paddingVertical: 12, borderRadius: 20, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.success, shadowColor: colors.bg, shadowOpacity: 0.65, shadowRadius: 18, elevation: 18 },
  arenaPeekTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginBottom: 8 },
});
