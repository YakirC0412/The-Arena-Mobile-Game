import { useMemo, useReducer, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArenaBuildScreen } from '@/features/arena/arena-build-screen';
import { DrawAnimationScreen } from '@/features/arena/draw-animation-screen';
import { AiBattleSimulationScreen } from '@/features/battle/ai-battle-simulation-screen';
import { AiDecisionScreen } from '@/features/battle/ai-decision-screen';
import { AiTargetSelectionScreen } from '@/features/battle/ai-target-selection-screen';
import { BattleIntroScreen } from '@/features/battle/battle-intro-screen';
import { BattleOutcomeScreen } from '@/features/battle/battle-outcome-screen';
import { BattleView } from '@/features/battle/battle-view';
import { ConquestAnimationScreen } from '@/features/battle/conquest-animation-screen';
import { ChampionCelebrationScreen } from '@/features/final/champion-celebration-screen';
import { FinalCategoryScreen } from '@/features/final/final-category-screen';
import { FinalRevealScreen } from '@/features/final/final-reveal-screen';
import { GameOverScreen } from '@/features/final/game-over-screen';
import { GuideScreen } from '@/features/onboarding/guide-screen';
import { HomeScreen } from '@/features/onboarding/home-screen';
import { IntroScreen } from '@/features/onboarding/intro-screen';
import { WelcomeScreen } from '@/features/onboarding/welcome-screen';
import { getFinalCategoryChooser, getNeighborPlayerIds } from '@/game/engine';
import { createFlowState, flowReducer, type FlowUser } from '@/game/flow';
import { createSeed, createSeededRandom } from '@/game/rng';
import type { WayId } from '@/game/types';
import { loadAccountStore, saveAccountStore } from '@/services/accounts/account-storage';
import { getCurrentUser, signOut } from '@/services/accounts/accounts';
import { AppText as Text } from '@/design/app-text';
import { ArenaScreen } from './arena-screen';
import { styles } from './flow-styles';
import { ResultScreen } from './result-screen';
import { SetupScreen } from './setup-screen';

// Renders the screen for the current flow state. Every transition lives in
// game/flow.ts (flowReducer); this component only maps screens to components
// and buttons to actions.
export function GameFlow() {
  // A user who signed in on an earlier visit lands straight on the home screen.
  const [flow, dispatch] = useReducer(flowReducer, undefined, () => createFlowState(createSeed(), getCurrentUser(loadAccountStore())));
  // Stable callbacks, so screens' timers are not restarted on every render.
  const on = useMemo(() => ({
    introComplete: () => dispatch({ type: 'INTRO_COMPLETE' }),
    signedIn: (user: FlowUser) => dispatch({ type: 'SIGNED_IN', user }),
    signOut: () => {
      saveAccountStore(signOut(loadAccountStore()));
      dispatch({ type: 'SIGN_OUT' });
    },
    homeGuide: () => dispatch({ type: 'HOME_GUIDE' }),
    homeNewGame: () => dispatch({ type: 'HOME_NEW_GAME' }),
    guideBack: () => dispatch({ type: 'GUIDE_BACK' }),
    guideComplete: () => dispatch({ type: 'GUIDE_COMPLETE' }),
    setupBack: () => dispatch({ type: 'SETUP_BACK' }),
    setupSelect: (categoryId: string) => dispatch({ type: 'SETUP_SELECT_CATEGORY', categoryId }),
    setupSelectWay: (wayId: WayId) => dispatch({ type: 'SETUP_SELECT_WAY', wayId }),
    startGame: () => dispatch({ type: 'START_GAME', seed: createSeed() }),
    buildComplete: () => dispatch({ type: 'BUILD_COMPLETE' }),
    draw: () => dispatch({ type: 'DRAW' }),
    skipToMyTurn: () => dispatch({ type: 'SKIP_TO_MY_TURN' }),
    drawComplete: () => dispatch({ type: 'DRAW_COMPLETE' }),
    selectTarget: (targetId: string) => dispatch({ type: 'SELECT_TARGET', targetId }),
    confirmTarget: () => dispatch({ type: 'CONFIRM_TARGET' }),
    aiTargetComplete: () => dispatch({ type: 'AI_TARGET_COMPLETE' }),
    battleIntroComplete: () => dispatch({ type: 'BATTLE_INTRO_COMPLETE' }),
    battleComplete: (winnerId: string) => dispatch({ type: 'BATTLE_COMPLETE', winnerId }),
    outcomeComplete: () => dispatch({ type: 'OUTCOME_COMPLETE' }),
    conquestComplete: () => dispatch({ type: 'CONQUEST_COMPLETE' }),
    resultContinue: () => dispatch({ type: 'RESULT_CONTINUE' }),
    returnToArena: () => dispatch({ type: 'RETURN_TO_ARENA' }),
    aiDecisionComplete: () => dispatch({ type: 'AI_DECISION_COMPLETE' }),
    finalRevealComplete: () => dispatch({ type: 'FINAL_REVEAL_COMPLETE' }),
    finalCategorySelect: (categoryId: string) => dispatch({ type: 'FINAL_CATEGORY_SELECT', categoryId }),
    eliminatedContinue: () => dispatch({ type: 'ELIMINATED_CONTINUE' }),
    victoryComplete: () => dispatch({ type: 'VICTORY_COMPLETE' }),
  }), []);
  // The live duel gets its own seeded source, fixed for the whole duel.
  const battleRandom = useMemo(() => createSeededRandom(flow.battleSeed), [flow.battleSeed]);

  const { battle, battleOrigin, game, resolution, screen } = flow;

  switch (screen) {
    case 'intro':
      return (
        <IntroScreen
          greeting={flow.user ? `ברוכים הבאים, ${flow.user.nickname}` : undefined}
          onDone={on.introComplete}
        />
      );
    case 'welcome':
      return <WelcomeScreen onSignedIn={on.signedIn} />;
    case 'home':
      if (!flow.user) return null;
      return (
        <HomeScreen
          avatar={flow.user.avatar}
          nickname={flow.user.nickname}
          onGuide={on.homeGuide}
          onNewGame={on.homeNewGame}
          onSignOut={on.signOut}
        />
      );
    case 'guide':
      return <GuideScreen onBack={on.guideBack} onComplete={on.guideComplete} />;
    case 'setup':
      return (
        <SetupScreen
          onBack={on.setupBack}
          onSelect={on.setupSelect}
          onSelectWay={on.setupSelectWay}
          onStart={on.startGame}
          selectedCategoryId={flow.selectedCategoryId}
          selectedWayId={flow.selectedWayId}
        />
      );
  }

  if (!game) return null;

  switch (screen) {
    case 'building':
      return <ArenaBuildScreen onComplete={on.buildComplete} state={game} />;

    case 'arena':
      return (
        <ArenaScreen
          game={game}
          onConfirmTarget={on.confirmTarget}
          onDraw={on.draw}
          onSelectTarget={on.selectTarget}
          onSkipToMyTurn={on.skipToMyTurn}
          selectedTargetId={flow.selectedTargetId}
          selectingTarget={flow.selectingTarget}
        />
      );

    case 'draw':
      return withSkipNotice(flow.skippedDuels, <DrawAnimationScreen onComplete={on.drawComplete} state={game} />);

    case 'aiTarget':
      if (!flow.aiAttackerId || !flow.aiTargetId) return null;
      return (
        <AiTargetSelectionScreen
          onComplete={on.aiTargetComplete}
          state={game}
          targetId={flow.aiTargetId}
          winnerId={flow.aiAttackerId}
        />
      );

    case 'selection':
      if (!battle) return null;
      return withSkipNotice(flow.skippedDuels, (
        <BattleIntroScreen
          battleNumber={flow.battleNumber}
          onComplete={on.battleIntroComplete}
          setup={battle}
          state={game}
        />
      ));

    case 'battle':
      if (!battle) return null;
      return (
        <SafeAreaView style={styles.safe}>
          <BattleView onComplete={on.battleComplete} random={battleRandom} setup={battle} state={game} />
        </SafeAreaView>
      );

    case 'aiBattle':
      if (!battle || !flow.aiWinnerId) return null;
      return (
        <AiBattleSimulationScreen
          onComplete={on.battleComplete}
          setup={battle}
          state={game}
          winnerId={flow.aiWinnerId}
        />
      );

    case 'outcome':
      if (!resolution) return null;
      return <BattleOutcomeScreen onComplete={on.outcomeComplete} resolution={resolution} />;

    case 'conquest':
      if (!battleOrigin || !resolution) return null;
      return (
        <ConquestAnimationScreen
          beforeState={battleOrigin}
          onComplete={on.conquestComplete}
          resolution={resolution}
        />
      );

    case 'result': {
      if (!resolution) return null;
      return (
        <ResultScreen
          canContinue={getNeighborPlayerIds(game, resolution.winnerId).length > 0}
          onContinue={on.resultContinue}
          onReturn={on.returnToArena}
          resolution={resolution}
          state={game}
        />
      );
    }

    case 'decision':
      if (!resolution) return null;
      return (
        <AiDecisionScreen
          continues={flow.aiContinues}
          onDecision={on.aiDecisionComplete}
          winnerName={game.players[resolution.winnerId].name}
        />
      );

    case 'finalReveal':
      return <FinalRevealScreen onComplete={on.finalRevealComplete} state={game} />;

    case 'finalCategory': {
      const chooser = getFinalCategoryChooser(game);
      if (!chooser) return null;
      return (
        <FinalCategoryScreen
          aiCategoryId={flow.aiFinalCategoryId}
          chooserId={chooser.id}
          onSelect={on.finalCategorySelect}
          state={game}
        />
      );
    }

    case 'eliminated':
      return (
        <GameOverScreen
          eliminatedById={resolution?.winnerId}
          onContinue={on.eliminatedContinue}
          state={game}
        />
      );

    case 'victory':
      if (!battleOrigin || !resolution) return null;
      return (
        <ChampionCelebrationScreen
          beforeState={battleOrigin}
          onComplete={on.victoryComplete}
          resolution={resolution}
        />
      );
  }
}

// After "skip to my turn": a short note on how many duels were decided.
function withSkipNotice(skippedDuels: number, screen: ReactNode) {
  if (skippedDuels === 0) return screen;
  return (
    <View style={styles.safe}>
      {screen}
      <View pointerEvents="none" style={styles.skipNotice}>
        <Text style={styles.skipNoticeText}>
          {skippedDuels === 1 ? 'דו־קרב אחד הוכרע ברקע' : `${skippedDuels} דו־קרבות הוכרעו ברקע`}
        </Text>
      </View>
    </View>
  );
}
