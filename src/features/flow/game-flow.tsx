import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArenaBoard } from '@/features/arena/arena-board';
import { ArenaBuildScreen } from '@/features/arena/arena-build-screen';
import { BattleView } from '@/features/battle/battle-view';
import { ChampionCelebrationScreen } from '@/features/final/champion-celebration-screen';
import { AiBattleSimulationScreen } from '@/features/battle/ai-battle-simulation-screen';
import { AiDecisionScreen } from '@/features/battle/ai-decision-screen';
import { AiTargetSelectionScreen } from '@/features/battle/ai-target-selection-screen';
import { BattleIntroScreen } from '@/features/battle/battle-intro-screen';
import { BattleOutcomeScreen } from '@/features/battle/battle-outcome-screen';
import { ConquestAnimationScreen } from '@/features/battle/conquest-animation-screen';
import { DrawAnimationScreen } from '@/features/arena/draw-animation-screen';
import { GameOverScreen } from '@/features/final/game-over-screen';
import { FinalCategoryScreen } from '@/features/final/final-category-screen';
import { FinalRevealScreen } from '@/features/final/final-reveal-screen';
import { AuthScreen } from '@/features/onboarding/auth-screen';
import { GameModeScreen } from '@/features/onboarding/game-mode-screen';
import { GuideScreen } from '@/features/onboarding/guide-screen';
import { type PlayerProfile } from '@/features/onboarding/player-profile';
import { WelcomeScreen } from '@/features/onboarding/welcome-screen';
import { CATEGORY_BY_ID } from '@/content/categories';
import { DEFAULT_AVATAR_ID } from '@/content/avatars';
import { chooseAiTarget, createFinalBattleSetup, createBattleSetup, createInitialGame, drawPlayer, getChampion, getFinalCategoryChooser, getNeighborPlayerIds, getRoundProgress, resolveBattle, simulateAiBattle } from '@/game/engine';
import type { BattleResolution, BattleSetup, GameState } from '@/game/types';
import { SetupScreen } from './setup-screen';
import { ResultScreen } from './result-screen';
import { styles } from './flow-styles';

type Screen = 'welcome' | 'auth' | 'mode' | 'guide' | 'setup' | 'building' | 'arena' | 'draw' | 'selection' | 'aiBattle' | 'battle' | 'outcome' | 'conquest' | 'result' | 'decision' | 'aiTarget' | 'finalReveal' | 'finalCategory' | 'victory' | 'gameover';

export function GameFlow() {
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
