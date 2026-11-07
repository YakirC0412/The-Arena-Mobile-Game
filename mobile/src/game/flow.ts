// The local game's screen flow as a pure reducer: every screen change happens
// here, in one place, and can be tested without React. Screens only render a
// FlowState and dispatch FlowActions. Randomness comes from `randomState`, so
// the reducer stays pure (and safe to call twice, as React may in dev).
import {
  autoPlayGame,
  chooseAiFinalCategory,
  chooseAiTarget,
  createBattleSetup,
  createFinalBattleSetup,
  createInitialGame,
  decideAiContinue,
  drawPlayer,
  fastForwardToHuman,
  getChampion,
  getFinalCategoryChooser,
  getNeighborPlayerIds,
  resolveBattle,
  returnWinnerToArena,
  simulateAiBattle,
} from './engine';
import { DEFAULT_AVATAR_ID } from '../content/avatars';
import { CATEGORY_BY_ID, getAvailableWays } from '../content/categories';
import { createRandomCursor, type RandomSource } from './rng';
import type { BattleResolution, BattleSetup, GameState, WayId } from './types';

export type FlowScreen =
  // animated opening, sign-up / sign-in, then the signed-in home
  | 'intro' | 'welcome' | 'home' | 'guide' | 'setup'
  // online: the waiting room of a multiplayer game (opened from the Multi tab of home)
  | 'lobby'
  // arena
  | 'building' | 'arena' | 'draw' | 'aiTarget'
  // duel
  | 'selection' | 'battle' | 'aiBattle' | 'outcome' | 'conquest' | 'result' | 'decision'
  // end of game
  | 'finalReveal' | 'finalCategory' | 'eliminated' | 'victory';

// The signed-in player as the flow sees it (see services/accounts).
export type FlowUser = {
  id: string;
  fullName: string;
  email: string;
  nickname: string;
  avatar: string;
};

// The two ways to play, as the toggle at the bottom of home.
export type HomeTab = 'single' | 'multi';

// The room the player opened from the Multi tab (the lobby screen shows it).
export type LobbyEntry = {
  roomId: string;
  code: string;
  name: string;
  // Watching a started or full room: no category, no start button.
  watching: boolean;
  // True when this player created the room (roomId is then empty until the server creates it).
  isHost: boolean;
  // Only for a room being created.
  visibility?: 'public' | 'private';
};

export type FlowState = {
  screen: FlowScreen;
  homeTab: HomeTab;
  lobby: LobbyEntry | null;
  user: FlowUser | null;
  selectedCategoryId: string;
  // How the player's category is played (decision 15).
  selectedWayId: WayId;
  randomState: number;
  game: GameState | null;
  // The duel being played: its setup and the board before it.
  battle: BattleSetup | null;
  battleOrigin: GameState | null;
  battleNumber: number;
  // Seed for the live duel screen (item order, bot timing).
  battleSeed: number;
  resolution: BattleResolution | null;
  aiWinnerId: string | null;
  aiAttackerId: string | null;
  aiTargetId: string | null;
  aiContinues: boolean;
  aiFinalCategoryId: string | null;
  selectingTarget: boolean;
  selectedTargetId: string | null;
  humanEliminated: boolean;
  // Duels the last "skip to my turn" played in the background (0 = none).
  skippedDuels: number;
};

export type FlowAction =
  | { type: 'INTRO_COMPLETE' }
  | { type: 'SIGNED_IN'; user: FlowUser }
  | { type: 'SIGN_OUT' }
  | { type: 'HOME_GUIDE' }
  | { type: 'HOME_NEW_GAME' }
  | { type: 'HOME_TAB'; tab: HomeTab }
  | { type: 'LOBBY_OPEN'; entry: LobbyEntry }
  | { type: 'LOBBY_BACK' }
  | { type: 'GUIDE_BACK' }
  | { type: 'GUIDE_COMPLETE' }
  | { type: 'SETUP_BACK' }
  | { type: 'SETUP_SELECT_CATEGORY'; categoryId: string }
  | { type: 'SETUP_SELECT_WAY'; wayId: WayId }
  | { type: 'START_GAME'; seed: number }
  | { type: 'BUILD_COMPLETE' }
  | { type: 'DRAW' }
  | { type: 'SKIP_TO_MY_TURN' }
  | { type: 'DRAW_COMPLETE' }
  | { type: 'SELECT_TARGET'; targetId: string }
  | { type: 'CONFIRM_TARGET' }
  | { type: 'AI_TARGET_COMPLETE' }
  | { type: 'BATTLE_INTRO_COMPLETE' }
  | { type: 'BATTLE_COMPLETE'; winnerId: string }
  | { type: 'OUTCOME_COMPLETE' }
  | { type: 'CONQUEST_COMPLETE' }
  | { type: 'RESULT_CONTINUE' }
  | { type: 'RETURN_TO_ARENA' }
  | { type: 'AI_DECISION_COMPLETE' }
  | { type: 'FINAL_REVEAL_COMPLETE' }
  | { type: 'FINAL_CATEGORY_SELECT'; categoryId: string }
  | { type: 'ELIMINATED_CONTINUE' }
  | { type: 'VICTORY_COMPLETE' };

// Every visit opens with the intro; a remembered user then lands on home.
export function createFlowState(seed: number, user: FlowUser | null = null, homeTab: HomeTab = 'single'): FlowState {
  return {
    screen: 'intro',
    homeTab,
    lobby: null,
    user,
    selectedCategoryId: 'animals',
    selectedWayId: 'w1',
    randomState: seed >>> 0,
    game: null,
    battle: null,
    battleOrigin: null,
    battleNumber: 0,
    battleSeed: 0,
    resolution: null,
    aiWinnerId: null,
    aiAttackerId: null,
    aiTargetId: null,
    aiContinues: false,
    aiFinalCategoryId: null,
    selectingTarget: false,
    selectedTargetId: null,
    humanEliminated: false,
    skippedDuels: 0,
  };
}

const CLEARED_BATTLE = {
  battle: null,
  battleOrigin: null,
  resolution: null,
  aiWinnerId: null,
  aiAttackerId: null,
  aiTargetId: null,
  aiFinalCategoryId: null,
  selectingTarget: false,
  selectedTargetId: null,
  skippedDuels: 0,
} as const;

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  const cursor = createRandomCursor(state.randomState);
  const next = reduce(state, action, cursor.random);
  if (next === state) return state;
  // START_GAME installs its own seed; every other action advances the cursor.
  return next.randomState !== state.randomState ? next : { ...next, randomState: cursor.state() };
}

function reduce(state: FlowState, action: FlowAction, random: RandomSource): FlowState {
  const at = (screen: FlowScreen): FlowState => ({ ...state, screen });

  switch (action.type) {
    case 'INTRO_COMPLETE': return at(state.user ? 'home' : 'welcome');
    // The intro plays again before the home screen, as a welcome.
    case 'SIGNED_IN': return { ...state, user: action.user, screen: 'intro' };
    case 'SIGN_OUT': return { ...state, ...CLEARED_BATTLE, user: null, game: null, lobby: null, homeTab: 'single', screen: 'welcome' };
    case 'HOME_GUIDE': return at('guide');
    case 'HOME_NEW_GAME': return at('setup');
    case 'HOME_TAB': return state.homeTab === action.tab ? state : { ...state, homeTab: action.tab };
    case 'LOBBY_OPEN': return { ...state, lobby: action.entry, screen: 'lobby' };
    case 'LOBBY_BACK': return { ...state, lobby: null, homeTab: 'multi', screen: 'home' };
    case 'GUIDE_BACK': return at('home');
    case 'GUIDE_COMPLETE': return at('setup');
    case 'SETUP_BACK': return at('home');
    case 'SETUP_SELECT_CATEGORY': {
      // Only playable categories can be picked; the first available way is preselected.
      const ways = getAvailableWays(CATEGORY_BY_ID[action.categoryId]);
      if (ways.length === 0) return state;
      return { ...state, selectedCategoryId: action.categoryId, selectedWayId: ways[0].id };
    }
    case 'SETUP_SELECT_WAY': {
      const ways = getAvailableWays(CATEGORY_BY_ID[state.selectedCategoryId]);
      if (!ways.some((way) => way.id === action.wayId)) return state;
      return { ...state, selectedWayId: action.wayId };
    }

    case 'START_GAME': {
      // A fresh seed per game, so one game's choices never leak into the next.
      const gameCursor = createRandomCursor(action.seed);
      const game = createInitialGame(
        state.selectedCategoryId,
        gameCursor.random,
        state.user?.nickname || 'אני',
        state.user?.avatar ?? DEFAULT_AVATAR_ID,
        state.selectedWayId,
      );
      return {
        ...state,
        ...CLEARED_BATTLE,
        screen: 'building',
        game,
        randomState: gameCursor.state(),
        battleNumber: 0,
        humanEliminated: false,
        aiContinues: false,
      };
    }
  }

  const game = state.game;
  if (!game) return state;

  switch (action.type) {
    case 'BUILD_COMPLETE': return at('arena');

    case 'DRAW':
      return { ...state, game: drawPlayer(game, random), selectingTarget: false, skippedDuels: 0, screen: 'draw' };

    case 'SKIP_TO_MY_TURN': {
      // Bot-vs-bot duels run in the background until the human plays again.
      if (state.selectingTarget || !game.players[game.humanPlayerId].isActive) return state;
      const result = fastForwardToHuman(game, random);
      const skipped = { ...state, ...CLEARED_BATTLE, game: result.state, skippedDuels: result.duels, battleNumber: state.battleNumber + result.duels };
      if (result.stop.kind === 'humanDrawn') return { ...skipped, screen: 'draw' };
      if (result.stop.kind === 'final') return { ...skipped, screen: 'finalReveal' };
      const withSkip = launchBattle(skipped, result.state, createBattleSetup(result.state, result.stop.attackerId, game.humanPlayerId), random);
      return { ...withSkip, skippedDuels: result.duels };
    }

    case 'DRAW_COMPLETE': {
      const selected = game.selectedPlayerId ? game.players[game.selectedPlayerId] : null;
      if (!selected) return state;
      if (selected.isHuman) {
        return { ...state, selectingTarget: true, selectedTargetId: null, screen: 'arena' };
      }
      return aiChoosesTarget(state, game, selected.id, random);
    }

    case 'SELECT_TARGET':
      return { ...state, selectedTargetId: action.targetId };

    case 'CONFIRM_TARGET':
      if (!game.selectedPlayerId || !state.selectedTargetId) return state;
      return launchBattle(state, game, createBattleSetup(game, game.selectedPlayerId, state.selectedTargetId), random);

    case 'AI_TARGET_COMPLETE':
      if (!state.aiAttackerId || !state.aiTargetId) return state;
      return launchBattle(state, game, createBattleSetup(game, state.aiAttackerId, state.aiTargetId), random);

    case 'BATTLE_INTRO_COMPLETE': {
      const battle = state.battle;
      if (!battle) return state;
      const humanPlays = game.players[battle.attackerId].isHuman || game.players[battle.defenderId].isHuman;
      if (humanPlays) return at('battle');
      return { ...state, aiWinnerId: simulateAiBattle(game, battle, random), screen: 'aiBattle' };
    }

    case 'BATTLE_COMPLETE': {
      if (!state.battle || !state.battleOrigin) return state;
      const resolution = resolveBattle(state.battleOrigin, state.battle, action.winnerId);
      return {
        ...state,
        game: resolution.state,
        resolution,
        humanEliminated: resolution.loserId === game.humanPlayerId,
        screen: 'outcome',
      };
    }

    case 'OUTCOME_COMPLETE':
      if (getChampion(game)) return at(state.humanEliminated ? 'eliminated' : 'victory');
      return at('conquest');

    case 'CONQUEST_COMPLETE':
      // Decision 5: a human who was knocked out sees the loss screen first.
      if (state.humanEliminated) return at('eliminated');
      if (getFinalCategoryChooser(game)) return at('finalReveal');
      return at('result');

    case 'RESULT_CONTINUE': {
      if (!state.resolution) return state;
      const winner = game.players[state.resolution.winnerId];
      if (getNeighborPlayerIds(game, winner.id).length === 0) return returnToArena(state, game);
      if (winner.isHuman) {
        return {
          ...state,
          ...CLEARED_BATTLE,
          game: { ...game, selectedPlayerId: winner.id },
          selectingTarget: true,
          screen: 'arena',
        };
      }
      return { ...state, aiContinues: decideAiContinue(game, winner.id, random), screen: 'decision' };
    }

    case 'RETURN_TO_ARENA':
      return returnToArena(state, game);

    case 'AI_DECISION_COMPLETE': {
      if (!state.resolution) return state;
      if (!state.aiContinues) return returnToArena(state, game);
      return aiChoosesTarget(state, game, state.resolution.winnerId, random);
    }

    case 'FINAL_REVEAL_COMPLETE': {
      const chooser = getFinalCategoryChooser(game);
      if (!chooser) return state;
      return {
        ...state,
        aiFinalCategoryId: chooser.isHuman ? null : chooseAiFinalCategory(game, chooser.id, random),
        screen: 'finalCategory',
      };
    }

    case 'FINAL_CATEGORY_SELECT': {
      const chooser = getFinalCategoryChooser(game);
      if (!chooser) return state;
      return launchBattle(state, game, createFinalBattleSetup(game, chooser.id, action.categoryId), random);
    }

    case 'ELIMINATED_CONTINUE': {
      // Decision 5: finish the game in the background and show its champion.
      if (getChampion(game)) return at('victory');
      const winnerId = state.resolution?.winnerId ?? null;
      const winnerContinues = winnerId !== null && decideAiContinue(game, winnerId, random);
      const result = autoPlayGame(
        winnerContinues ? game : returnWinnerToArena(game, winnerId),
        random,
        { attackerId: winnerContinues ? winnerId : null },
      );
      return {
        ...state,
        game: result.state,
        battleOrigin: result.lastBattle?.before ?? state.battleOrigin,
        resolution: result.lastBattle?.resolution ?? state.resolution,
        battleNumber: state.battleNumber + result.duels,
        screen: 'victory',
      };
    }

    // Decision 5: after the champion screen, back to the home screen.
    case 'VICTORY_COMPLETE':
      return at('home');
  }

  return state;
}

function launchBattle(state: FlowState, game: GameState, battle: BattleSetup, random: RandomSource): FlowState {
  return {
    ...state,
    ...CLEARED_BATTLE,
    game,
    battle,
    battleOrigin: game,
    battleNumber: state.battleNumber + 1,
    battleSeed: Math.floor(random() * 4294967296),
    screen: 'selection',
  };
}

function aiChoosesTarget(state: FlowState, game: GameState, attackerId: string, random: RandomSource): FlowState {
  const targetId = chooseAiTarget(game, attackerId, random);
  if (!targetId) return returnToArena(state, game);
  return { ...state, aiAttackerId: attackerId, aiTargetId: targetId, screen: 'aiTarget' };
}

function returnToArena(state: FlowState, game: GameState): FlowState {
  return {
    ...state,
    ...CLEARED_BATTLE,
    game: returnWinnerToArena(game, state.resolution?.winnerId ?? null),
    screen: 'arena',
  };
}
