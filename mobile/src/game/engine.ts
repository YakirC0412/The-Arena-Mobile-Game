import { CATEGORIES, CATEGORY_BY_ID } from '../content/categories';
import { AVATARS, DEFAULT_AVATAR_ID } from '../content/avatars';
import type {
  ArenaPlayer,
  BattleResolution,
  BattleSetup,
  CategoryItem,
  GameState,
} from './types';
import type { RandomSource } from './rng';

export type { RandomSource } from './rng';

const PLAYER_COLORS = [
  '#21C7A8', '#FF5D73', '#FFBE3D', '#3287FF',
  '#9B6DFF', '#FF7A36', '#19B8D6', '#E94FA3',
  '#63C955', '#E3D23C', '#536FDB', '#C43D52',
  '#96D83D', '#7147C7', '#D56B00', '#168B78',
];

const FEMALE_NAMES = [
  'נועה', 'מאיה', 'ליה', 'רוני', 'תמר', 'שירה',
  'יעל', 'דנה', 'איילת', 'מיכל', 'נעמה', 'הדר',
];

const MALE_NAMES = [
  'עומר', 'איתי', 'יונתן', 'דניאל', 'אורי', 'נועם',
  'גיא', 'אדם', 'יואב', 'רועי', 'אופיר', 'אלון',
];

function shuffle<T>(values: T[], random: RandomSource): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function createBattleDeck(
  items: CategoryItem[],
  random: RandomSource = Math.random,
): CategoryItem[] {
  return ([1, 2, 3] as const).flatMap((difficulty) => (
    shuffle(items.filter((item) => item.difficulty === difficulty), random)
  ));
}

export function createInitialGame(
  humanCategoryId: string,
  random: RandomSource = Math.random,
  humanName = 'אני',
  humanAvatar = DEFAULT_AVATAR_ID,
): GameState {
  if (!CATEGORY_BY_ID[humanCategoryId]) {
    throw new Error(`Unknown category: ${humanCategoryId}`);
  }

  const remainingCategories = shuffle(
    CATEGORIES.filter((item) => item.id !== humanCategoryId),
    random,
  );
  const selectedAvatar = AVATARS.find((avatar) => avatar.id === humanAvatar) ?? AVATARS[0];
  const remainingAvatars = shuffle(
    AVATARS.filter((avatar) => avatar.id !== selectedAvatar.id),
    random,
  );
  const namesByGender = {
    female: shuffle(FEMALE_NAMES, random),
    male: shuffle(MALE_NAMES, random),
  };
  const nameIndexes = { female: 0, male: 0 };
  const humanCellId = Math.floor(random() * 16);
  const players: Record<string, ArenaPlayer> = {};
  const cells = Array.from({ length: 16 }, (_, cellId) => {
    const isHuman = cellId === humanCellId;
    const playerIndex = isHuman ? 0 : cellId < humanCellId ? cellId + 1 : cellId;
    const playerId = isHuman ? 'human' : `ai-${playerIndex}`;
    const aiCategoryIndex = cellId < humanCellId ? cellId : cellId - 1;
    const categoryId = isHuman ? humanCategoryId : remainingCategories[aiCategoryIndex].id;
    const aiAvatar = remainingAvatars[aiCategoryIndex];
    const aiName = isHuman
      ? humanName
      : namesByGender[aiAvatar.gender][nameIndexes[aiAvatar.gender]++];

    players[playerId] = {
      id: playerId,
      name: aiName,
      avatar: isHuman ? selectedAvatar.id : aiAvatar.id,
      color: PLAYER_COLORS[cellId],
      isHuman,
      isActive: true,
      categoryId,
      cellIds: [cellId],
      hasPlayedThisRound: false,
      winStreak: 0,
      bonusReady: false,
    };

    return {
      id: cellId,
      row: Math.floor(cellId / 4),
      column: cellId % 4,
      ownerId: playerId,
    };
  });

  return {
    cells,
    players,
    humanPlayerId: 'human',
    round: 1,
    selectedPlayerId: null,
    events: [{ id: 'event-0', text: 'הזירה מוכנה. הגרילו את המתמודד הראשון.' }],
    eventCount: 1,
  };
}

export function getActivePlayers(state: GameState): ArenaPlayer[] {
  return Object.values(state.players).filter((player) => player.isActive);
}

export function getDrawCandidates(state: GameState): ArenaPlayer[] {
  const active = getActivePlayers(state);
  const notDrawnYet = active.filter((player) => !player.hasPlayedThisRound);
  return notDrawnYet.length > 0 ? notDrawnYet : active;
}

export function getRoundProgress(state: GameState) {
  const active = getActivePlayers(state);
  const drawn = active.filter((player) => player.hasPlayedThisRound).length;
  return {
    drawn,
    remaining: active.length - drawn,
    total: active.length,
  };
}

export function createRandomDrawSequence(
  candidateIds: string[],
  steps = 34,
  random: RandomSource = Math.random,
): string[] {
  if (candidateIds.length === 0) return [];
  const sequence: string[] = [];
  let previousId: string | null = null;

  for (let step = 0; step < steps; step += 1) {
    const alternatives = candidateIds.filter((candidateId) => candidateId !== previousId);
    const pool = alternatives.length > 0 ? alternatives : candidateIds;
    const selectedId = pool[Math.floor(random() * pool.length)];
    sequence.push(selectedId);
    previousId = selectedId;
  }

  return sequence;
}

export function getNeighborPlayerIds(state: GameState, playerId: string): string[] {
  const player = state.players[playerId];
  if (!player?.isActive) return [];

  const result = new Set<string>();
  for (const cellId of player.cellIds) {
    const cell = state.cells[cellId];
    const candidates = [
      [cell.row - 1, cell.column],
      [cell.row + 1, cell.column],
      [cell.row, cell.column - 1],
      [cell.row, cell.column + 1],
    ];

    for (const [row, column] of candidates) {
      if (row < 0 || row > 3 || column < 0 || column > 3) continue;
      const neighbor = state.cells[row * 4 + column];
      if (neighbor.ownerId !== playerId) result.add(neighbor.ownerId);
    }
  }

  return [...result].filter((id) => state.players[id]?.isActive);
}

export function drawPlayer(
  state: GameState,
  random: RandomSource = Math.random,
): GameState {
  const active = getActivePlayers(state);
  let round = state.round;
  let players = state.players;
  let candidates = getDrawCandidates(state);

  if (candidates.length === active.length && active.every((player) => player.hasPlayedThisRound)) {
    round += 1;
    players = Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [
        id,
        player.isActive ? { ...player, hasPlayedThisRound: false } : player,
      ]),
    );
    candidates = Object.values(players).filter((player) => player.isActive);
  }

  const selected = candidates[Math.floor(random() * candidates.length)];
  players = {
    ...players,
    [selected.id]: { ...selected, hasPlayedThisRound: true },
  };

  return {
    ...state,
    round,
    players,
    selectedPlayerId: selected.id,
    events: [
      { id: `event-${state.eventCount}`, text: `${selected.name} הוגרל/ה לשחק.` },
      ...state.events,
    ].slice(0, 6),
    eventCount: state.eventCount + 1,
  };
}

export function createBattleSetup(
  state: GameState,
  attackerId: string,
  defenderId: string,
): BattleSetup {
  if (!getNeighborPlayerIds(state, attackerId).includes(defenderId)) {
    throw new Error('Players are not adjacent');
  }

  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  return {
    attackerId,
    defenderId,
    categoryId: defender.categoryId,
    attackerSeconds: attacker.bonusReady ? 45 : 40,
    defenderSeconds: defender.bonusReady ? 45 : 40,
    attackerUsesBonus: attacker.bonusReady,
    defenderUsesBonus: defender.bonusReady,
  };
}

export function getFinalCategoryChooser(state: GameState): ArenaPlayer | null {
  const finalists = getActivePlayers(state);
  if (finalists.length !== 2) return null;
  const [first, second] = finalists;
  if (first.cellIds.length !== second.cellIds.length) {
    return first.cellIds.length > second.cellIds.length ? first : second;
  }
  const lastWinner = state.selectedPlayerId ? state.players[state.selectedPlayerId] : null;
  return lastWinner?.isActive ? lastWinner : first;
}

export function createFinalBattleSetup(
  state: GameState,
  chooserId: string,
  categoryId: string,
): BattleSetup {
  const finalists = getActivePlayers(state);
  const chooser = getFinalCategoryChooser(state);
  if (finalists.length !== 2 || chooser?.id !== chooserId) {
    throw new Error('Final category chooser is invalid');
  }
  if (!finalists.some((player) => player.categoryId === categoryId)) {
    throw new Error('Final category must belong to one of the finalists');
  }
  const opponent = finalists.find((player) => player.id !== chooserId)!;
  const setup = createBattleSetup(state, chooserId, opponent.id);
  return { ...setup, categoryId, isFinal: true };
}

// Decision 2 (GAME_RULES §5): every win counts toward the streak, defending
// included. A duel played with the bonus ends it and restarts the streak at 0.
function nextWinnerProgress(player: ArenaPlayer, usedBonus: boolean) {
  if (usedBonus) {
    return { winStreak: 0, bonusReady: false, earnedBonus: false };
  }
  const winStreak = player.winStreak + 1;
  return {
    winStreak,
    bonusReady: winStreak >= 3,
    earnedBonus: winStreak === 3,
  };
}

export function resolveBattle(
  state: GameState,
  setup: BattleSetup,
  winnerId: string,
): BattleResolution {
  if (winnerId !== setup.attackerId && winnerId !== setup.defenderId) {
    throw new Error('Battle winner must be one of the duel participants');
  }

  const loserId = winnerId === setup.attackerId ? setup.defenderId : setup.attackerId;
  const winner = state.players[winnerId];
  const loser = state.players[loserId];
  const winnerWasDefender = winnerId === setup.defenderId;
  const winnerUsedBonus = winnerId === setup.attackerId
    ? setup.attackerUsesBonus
    : setup.defenderUsesBonus;
  const loserUsedBonus = loserId === setup.attackerId
    ? setup.attackerUsesBonus
    : setup.defenderUsesBonus;
  const progress = nextWinnerProgress(winner, winnerUsedBonus);
  const categoryId = winnerWasDefender ? loser.categoryId : winner.categoryId;
  const conqueredCells = [...new Set([...winner.cellIds, ...loser.cellIds])]
    .sort((a, b) => a - b);

  const players: Record<string, ArenaPlayer> = {
    ...state.players,
    [winnerId]: {
      ...winner,
      categoryId,
      cellIds: conqueredCells,
      winStreak: progress.winStreak,
      bonusReady: progress.bonusReady,
    },
    [loserId]: {
      ...loser,
      isActive: false,
      cellIds: [],
      winStreak: 0,
      bonusReady: loserUsedBonus ? false : loser.bonusReady,
    },
  };

  const cells = state.cells.map((cell) => (
    cell.ownerId === loserId ? { ...cell, ownerId: winnerId } : cell
  ));
  const inheritedCategory = winnerWasDefender;
  const categoryName = CATEGORY_BY_ID[categoryId].name;
  const summary = inheritedCategory
    ? `${winner.name} ניצח/ה בהגנה, כבש/ה את כל השטח של ${loser.name} וירש/ה את הקטגוריה ${categoryName}.`
    : `${winner.name} ניצח/ה בהתקפה, כבש/ה את כל השטח של ${loser.name} ונשאר/ה עם הקטגוריה ${categoryName}.`;

  return {
    state: {
      ...state,
      cells,
      players,
      selectedPlayerId: winnerId,
      events: [{ id: `event-${state.eventCount}`, text: summary }, ...state.events].slice(0, 6),
      eventCount: state.eventCount + 1,
    },
    winnerId,
    loserId,
    inheritedCategory,
    winnerEarnedBonus: progress.earnedBonus,
    summary,
  };
}

// The winner stops attacking and the arena draws again. Returning ends the
// winner's streak, but a bonus that was already earned stays banked.
export function returnWinnerToArena(state: GameState, winnerId: string | null): GameState {
  const winner = winnerId ? state.players[winnerId] : null;
  return {
    ...state,
    selectedPlayerId: null,
    players: winner
      ? { ...state.players, [winner.id]: { ...winner, winStreak: 0 } }
      : state.players,
  };
}

export function getChampion(state: GameState): ArenaPlayer | null {
  const active = getActivePlayers(state);
  return active.length === 1 ? active[0] : null;
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/["'׳״.,!?()\-_/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('he')
    .replace(/[םןךףץ]/g, (letter) => ({ ם: 'מ', ן: 'נ', ך: 'כ', ף: 'פ', ץ: 'צ' })[letter] ?? letter);
}

export function isCorrectAnswer(answer: string, expected: string, aliases: string[]): boolean {
  const normalized = normalizeAnswer(answer);
  return [expected, ...aliases].some((candidate) => normalizeAnswer(candidate) === normalized);
}

export function simulateAiBattle(
  state: GameState,
  setup: BattleSetup,
  random: RandomSource = Math.random,
): string {
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const attackerPower = 0.48 + (setup.attackerUsesBonus ? 0.12 : 0) + Math.min(attacker.cellIds.length, 4) * 0.01;
  const defenderPower = 0.52 + (setup.defenderUsesBonus ? 0.12 : 0) + Math.min(defender.cellIds.length, 4) * 0.01;
  return random() < attackerPower / (attackerPower + defenderPower)
    ? setup.attackerId
    : setup.defenderId;
}

export function chooseAiTarget(
  state: GameState,
  attackerId: string,
  random: RandomSource = Math.random,
): string | null {
  const neighbors = getNeighborPlayerIds(state, attackerId);
  if (neighbors.length === 0) return null;
  const attacker = state.players[attackerId];
  const arenaLeaderSize = Math.max(
    ...getActivePlayers(state)
      .filter((player) => player.id !== attackerId)
      .map((player) => player.cellIds.length),
  );

  const ranked = neighbors
    .map((targetId) => {
      const targetSize = state.players[targetId].cellIds.length;
      const isArenaLeader = targetSize === arenaLeaderSize && targetSize > 1;
      const territoryReward = targetSize * 1.7;
      const retaliationRisk = Math.max(0, targetSize - attacker.cellIds.length) * 1.15;
      const leaderRisk = isArenaLeader && targetSize > attacker.cellIds.length ? 2.4 : 0;
      const variation = random() * 1.25;
      return { targetId, score: territoryReward - retaliationRisk - leaderRisk + variation };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0].targetId;
}

// --- Bot decisions -----------------------------------------------------------
// Bots never read Math.random directly; screens pass the game's seeded source.

const AI_CONTINUE_CHANCE = 0.38;
const AI_FINAL_OWN_CATEGORY_CHANCE = 0.65;

export function decideAiContinue(
  state: GameState,
  winnerId: string,
  random: RandomSource = Math.random,
): boolean {
  return getNeighborPlayerIds(state, winnerId).length > 0 && random() < AI_CONTINUE_CHANCE;
}

export function chooseAiFinalCategory(
  state: GameState,
  chooserId: string,
  random: RandomSource = Math.random,
): string {
  const chooser = state.players[chooserId];
  const opponent = getActivePlayers(state).find((player) => player.id !== chooserId);
  if (!opponent) return chooser.categoryId;
  return random() < AI_FINAL_OWN_CATEGORY_CHANCE ? chooser.categoryId : opponent.categoryId;
}

export type AiDuelOutcome = 'correct' | 'skip' | 'retry';

// A bot attempt in a live duel against the human happens in two steps: it
// "thinks" for aiThinkDelayMs, then decideAiDuelOutcome picks what it does
// with the time it has left. Harder items are slower and answered less often.
export function aiThinkDelayMs(
  difficulty: CategoryItem['difficulty'],
  random: RandomSource = Math.random,
): number {
  return 850 + difficulty * 450 + Math.floor(random() * 500);
}

export function decideAiDuelOutcome(
  difficulty: CategoryItem['difficulty'],
  remainingMs: number,
  random: RandomSource = Math.random,
): AiDuelOutcome {
  if (random() < 0.92 - difficulty * 0.15) return 'correct';
  return remainingMs < 6500 || random() < 0.45 ? 'skip' : 'retry';
}

// --- Duel timing -------------------------------------------------------------

export const SKIP_PENALTY_MS = 3000;
export const CORRECT_PAUSE_MIN_MS = 700;
export const CORRECT_PAUSE_MAX_MS = 1000;

// GAME_RULES §3: after a correct answer the turn passes after 0.7–1.0 s,
// with both clocks stopped.
export function correctAnswerPauseMs(random: RandomSource = Math.random): number {
  return CORRECT_PAUSE_MIN_MS + Math.round(random() * (CORRECT_PAUSE_MAX_MS - CORRECT_PAUSE_MIN_MS));
}

// --- Whole-game simulation ---------------------------------------------------

export type AutoPlayResult = {
  state: GameState;
  duels: number;
  champion: ArenaPlayer;
  // The deciding duel, for the champion celebration. Missing when the game
  // was already over before auto-play started.
  lastBattle?: { before: GameState; resolution: BattleResolution };
};

// Plays the game to the end with every contestant acting as a bot, following
// the same order as the screens: draw → target → duel → continue or return,
// and the final when two remain. Used by tests, and to finish a game in the
// background after the human is eliminated (decision 5).
export function autoPlayGame(
  initialState: GameState,
  random: RandomSource = Math.random,
  options: { attackerId?: string | null; maxDuels?: number } = {},
): AutoPlayResult {
  const maxDuels = options.maxDuels ?? 100;
  let state = initialState;
  let duels = 0;
  let attackerId: string | null = options.attackerId ?? null;
  let lastBattle: AutoPlayResult['lastBattle'];

  while (!getChampion(state)) {
    if (duels >= maxDuels) throw new Error('Auto-play did not finish');

    let setup: BattleSetup;
    const chooser = getFinalCategoryChooser(state);
    if (chooser) {
      setup = createFinalBattleSetup(state, chooser.id, chooseAiFinalCategory(state, chooser.id, random));
    } else {
      if (!attackerId) {
        state = drawPlayer(state, random);
        attackerId = state.selectedPlayerId!;
      }
      const targetId = chooseAiTarget(state, attackerId, random);
      if (!targetId) throw new Error(`${attackerId} has no neighbor to attack`);
      setup = createBattleSetup(state, attackerId, targetId);
    }

    const result = resolveBattle(state, setup, simulateAiBattle(state, setup, random));
    lastBattle = { before: state, resolution: result };
    state = result.state;
    duels += 1;

    if (getChampion(state) || getFinalCategoryChooser(state)) continue;
    if (decideAiContinue(state, result.winnerId, random)) {
      attackerId = result.winnerId;
    } else {
      state = returnWinnerToArena(state, result.winnerId);
      attackerId = null;
    }
  }

  return { state, duels, champion: getChampion(state)!, lastBattle };
}
