import {
  chooseAiTarget,
  createBattleDeck,
  createFinalBattleSetup,
  createBattleSetup,
  createInitialGame,
  createRandomDrawSequence,
  drawPlayer,
  getActivePlayers,
  getChampion,
  getDrawCandidates,
  getFinalCategoryChooser,
  getNeighborPlayerIds,
  getRoundProgress,
  isCorrectAnswer,
  resolveBattle,
} from '../src/game/engine';
import { CATEGORIES } from '../src/game/content';
import { AVATARS } from '../src/game/avatars';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixedRandom = () => 0;

const initial = createInitialGame('animals', fixedRandom);
assert(getActivePlayers(initial).length === 16, 'A new game must have 16 active players');
assert(initial.players.human.categoryId === 'animals', 'The human category must be preserved');
assert(getNeighborPlayerIds(initial, 'human').length === 2, 'A corner territory must have two neighbors');

const avatarState = createInitialGame('animals', fixedRandom, 'שחקן בדיקה', 'avatar-16');
const assignedAvatars = Object.values(avatarState.players).map((player) => player.avatar);
assert(new Set(assignedAvatars).size === 16, 'Every arena player must receive a unique avatar');
assert(avatarState.players.human.avatar === 'avatar-16', 'The selected human avatar must be preserved');
const femaleNames = new Set(['נועה', 'מאיה', 'ליה', 'רוני', 'תמר', 'שירה', 'יעל', 'דנה', 'איילת', 'מיכל', 'נעמה', 'הדר']);
const maleNames = new Set(['עומר', 'איתי', 'יונתן', 'דניאל', 'אורי', 'נועם', 'גיא', 'אדם', 'יואב', 'רועי', 'אופיר', 'אלון']);
for (const player of Object.values(avatarState.players).filter((candidate) => !candidate.isHuman)) {
  const gender = AVATARS.find((avatar) => avatar.id === player.avatar)?.gender;
  assert(
    gender === 'female' ? femaleNames.has(player.name) : maleNames.has(player.name),
    `Avatar gender and player name must match for ${player.id}`,
  );
}

const finalOpponentId = initial.cells[9].ownerId;
const finalHumanCells = initial.cells.slice(0, 9).map((cell) => cell.id);
const finalOpponentCells = initial.cells.slice(9).map((cell) => cell.id);
const finalState = {
  ...initial,
  cells: initial.cells.map((cell) => ({
    ...cell,
    ownerId: finalHumanCells.includes(cell.id) ? 'human' : finalOpponentId,
  })),
  players: Object.fromEntries(Object.entries(initial.players).map(([id, player]) => [
    id,
    id === 'human'
      ? { ...player, cellIds: finalHumanCells, isActive: true }
      : id === finalOpponentId
        ? { ...player, cellIds: finalOpponentCells, isActive: true }
        : { ...player, cellIds: [], isActive: false },
  ])),
  selectedPlayerId: 'human',
};
assert(getFinalCategoryChooser(finalState)?.id === 'human', 'The larger finalist must choose the final category');
const finalSetup = createFinalBattleSetup(
  finalState,
  'human',
  finalState.players[finalOpponentId].categoryId,
);
assert(finalSetup.isFinal === true, 'The final battle setup must be marked as final');
assert(finalSetup.categoryId === finalState.players[finalOpponentId].categoryId, 'The chooser may select the opponent category');
const tiedFinalState = {
  ...finalState,
  cells: finalState.cells.map((cell, index) => ({ ...cell, ownerId: index < 8 ? 'human' : finalOpponentId })),
  players: {
    ...finalState.players,
    human: { ...finalState.players.human, cellIds: finalState.cells.slice(0, 8).map((cell) => cell.id) },
    [finalOpponentId]: { ...finalState.players[finalOpponentId], cellIds: finalState.cells.slice(8).map((cell) => cell.id) },
  },
  selectedPlayerId: finalOpponentId,
};
assert(getFinalCategoryChooser(tiedFinalState)?.id === finalOpponentId, 'The last battle winner must break an 8-8 final tie');

const firstTarget = getNeighborPlayerIds(initial, 'human')[0];
assert(
  getNeighborPlayerIds(initial, 'human').includes(chooseAiTarget(initial, 'human', fixedRandom)!),
  'AI target selection must choose an adjacent active opponent',
);
const firstSetup = createBattleSetup(initial, 'human', firstTarget);
const attackerWin = resolveBattle(initial, firstSetup, 'human');
assert(attackerWin.state.players.human.cellIds.length === 2, 'Attacker must inherit the whole territory');
assert(attackerWin.state.players.human.categoryId === 'animals', 'Winning attacker must keep its category');
assert(!attackerWin.state.players[firstTarget].isActive, 'Losing player must be eliminated');
assert(
  attackerWin.state.cells.every((cell) => (
    !attackerWin.state.players.human.cellIds.includes(cell.id) || cell.ownerId === 'human'
  )),
  'Every conquered cell must belong to the winning attacker',
);

const multiCellBase = createInitialGame('animals', fixedRandom);
const multiCellDefenderId = getNeighborPlayerIds(multiCellBase, 'human')
  .find((playerId) => multiCellBase.players[playerId].cellIds[0] === 1)!;
const farCellOwnerId = multiCellBase.cells[2].ownerId;
const expandedDefender = resolveBattle(
  multiCellBase,
  createBattleSetup(multiCellBase, multiCellDefenderId, farCellOwnerId),
  multiCellDefenderId,
).state;
assert(
  expandedDefender.players[multiCellDefenderId].cellIds.length === 2,
  'A territory must be able to grow into multiple connected cells',
);
const wholeTerritorySetup = createBattleSetup(expandedDefender, 'human', multiCellDefenderId);
assert(
  wholeTerritorySetup.categoryId === expandedDefender.players[multiCellDefenderId].categoryId,
  'A duel must always use the defending territory category',
);
const wholeTerritoryWin = resolveBattle(expandedDefender, wholeTerritorySetup, 'human');
assert(
  wholeTerritoryWin.state.players.human.cellIds.length === 3,
  'Defeating a multi-cell territory must transfer all of its cells at once',
);
assert(
  wholeTerritoryWin.state.players.human.categoryId === 'animals',
  'An attacking winner must keep its category after taking a multi-cell territory',
);
assert(
  wholeTerritoryWin.state.cells.filter((cell) => [0, 1, 2].includes(cell.id))
    .every((cell) => cell.ownerId === 'human'),
  'All cells in the defeated territory must be recolored for the winner',
);

const defenderState = createInitialGame('animals', fixedRandom);
const defenderTarget = getNeighborPlayerIds(defenderState, 'human')[0];
const defenderCategoryBefore = defenderState.players[defenderTarget].categoryId;
const defenderSetup = createBattleSetup(defenderState, 'human', defenderTarget);
const defenderWin = resolveBattle(defenderState, defenderSetup, defenderTarget);
assert(defenderWin.inheritedCategory, 'A winning defender must inherit the attacker category');
assert(defenderWin.state.players[defenderTarget].categoryId === 'animals', 'Defender must receive the losing attacker category');
assert(defenderCategoryBefore !== defenderWin.state.players[defenderTarget].categoryId, 'Defender category should change');

const defenderAgainstTerritory = resolveBattle(
  expandedDefender,
  createBattleSetup(expandedDefender, multiCellDefenderId, 'human'),
  'human',
);
assert(
  defenderAgainstTerritory.state.players.human.cellIds.length === 3,
  'A defending winner must receive every cell owned by the attacking territory',
);
assert(
  defenderAgainstTerritory.state.players.human.categoryId
    === expandedDefender.players[multiCellDefenderId].categoryId,
  'A defending winner must inherit the losing attacker category',
);

let rejectedInvalidWinner = false;
try {
  resolveBattle(initial, firstSetup, 'not-a-participant');
} catch {
  rejectedInvalidWinner = true;
}
assert(rejectedInvalidWinner, 'A battle result must reject a winner outside the duel');

let streakState = createInitialGame('animals', fixedRandom);
for (let win = 0; win < 3; win += 1) {
  const target = getNeighborPlayerIds(streakState, 'human')[0];
  const setup = createBattleSetup(streakState, 'human', target);
  const streakResolution = resolveBattle(streakState, setup, 'human');
  assert(
    streakResolution.winnerEarnedBonus === (win === 2),
    'The bonus must be awarded exactly on the third consecutive win',
  );
  streakState = streakResolution.state;
}
assert(streakState.players.human.bonusReady, 'Three consecutive wins must bank the bonus');
assert(streakState.players.human.winStreak === 3, 'The streak must remain visible until the bonus duel');

let defenderThirdWinState = createInitialGame('animals', fixedRandom);
for (let win = 0; win < 2; win += 1) {
  const target = getNeighborPlayerIds(defenderThirdWinState, 'human')[0];
  defenderThirdWinState = resolveBattle(
    defenderThirdWinState,
    createBattleSetup(defenderThirdWinState, 'human', target),
    'human',
  ).state;
}
const defensiveAttackerId = getNeighborPlayerIds(defenderThirdWinState, 'human')[0];
const defensiveThirdResolution = resolveBattle(
  defenderThirdWinState,
  createBattleSetup(defenderThirdWinState, defensiveAttackerId, 'human'),
  'human',
);
assert(
  !defensiveThirdResolution.winnerEarnedBonus,
  'A defensive victory must not award the three-win bonus',
);
assert(
  defensiveThirdResolution.state.players.human.winStreak === 2,
  'A defensive victory must not advance the attacking win streak',
);
assert(
  !defensiveThirdResolution.state.players.human.bonusReady,
  'A defensive third battle must not bank a bonus',
);

let waitingWithBonus = streakState;
waitingWithBonus = drawPlayer({ ...waitingWithBonus, selectedPlayerId: null }, () => 0.99);
assert(
  waitingWithBonus.players.human.bonusReady,
  'Returning to the arena and running another draw must preserve the banked bonus',
);
assert(
  waitingWithBonus.players.human.winStreak === 3,
  'The three-win streak must stay banked while the player waits',
);

const bonusTarget = getNeighborPlayerIds(streakState, 'human')[0];
const bonusSetup = createBattleSetup(streakState, 'human', bonusTarget);
assert(bonusSetup.attackerSeconds === 45, 'The banked bonus must apply when attacking');
const bonusResult = resolveBattle(streakState, bonusSetup, 'human');
assert(!bonusResult.state.players.human.bonusReady, 'The bonus must reset after the bonus duel');
assert(bonusResult.state.players.human.winStreak === 0, 'The streak must reset after the bonus duel');

let defendingBonusState = createInitialGame('animals', fixedRandom);
for (let win = 0; win < 3; win += 1) {
  const target = getNeighborPlayerIds(defendingBonusState, 'human')[0];
  defendingBonusState = resolveBattle(
    defendingBonusState,
    createBattleSetup(defendingBonusState, 'human', target),
    'human',
  ).state;
}
const bonusAttackerId = getNeighborPlayerIds(defendingBonusState, 'human')[0];
const defendingBonusSetup = createBattleSetup(defendingBonusState, bonusAttackerId, 'human');
assert(defendingBonusSetup.defenderUsesBonus, 'The banked bonus must activate when defending');
assert(defendingBonusSetup.defenderSeconds === 45, 'A defending bonus player must start with 45 seconds');
const defendingBonusResult = resolveBattle(defendingBonusState, defendingBonusSetup, 'human');
assert(
  !defendingBonusResult.state.players.human.bonusReady,
  'The defending bonus must reset immediately after its duel',
);
assert(
  defendingBonusResult.state.players.human.winStreak === 0,
  'The streak must reset after using the bonus as defender',
);
const afterBonusTarget = getNeighborPlayerIds(defendingBonusResult.state, 'human')[0];
const afterBonusSetup = createBattleSetup(defendingBonusResult.state, 'human', afterBonusTarget);
assert(afterBonusSetup.attackerSeconds === 40, 'The five-second bonus may only be used once');

let drawState = createInitialGame('animals', fixedRandom);
const selectedIds = new Set<string>();
for (let draw = 0; draw < 16; draw += 1) {
  drawState = drawPlayer(drawState, fixedRandom);
  selectedIds.add(drawState.selectedPlayerId!);
}
assert(selectedIds.size === 16, 'Every active territory must be drawn once per round');
assert(getRoundProgress(drawState).drawn === 16, 'Round progress must count every drawn active player');
assert(
  getDrawCandidates(drawState).length === getActivePlayers(drawState).length,
  'After everyone was drawn, every active player must return to the lottery',
);
drawState = drawPlayer(drawState, fixedRandom);
assert(drawState.round === 2, 'The round must advance after all active territories played');
assert(getRoundProgress(drawState).drawn === 1, 'A new round must begin with only its first draw counted');

const defenderEligibilityBase = createInitialGame('animals', fixedRandom);
const drawnAttackerState = drawPlayer(defenderEligibilityBase, fixedRandom);
const drawnAttackerId = drawnAttackerState.selectedPlayerId!;
const undrawnDefenderId = getNeighborPlayerIds(drawnAttackerState, drawnAttackerId)[0];
const defenderVictory = resolveBattle(
  drawnAttackerState,
  createBattleSetup(drawnAttackerState, drawnAttackerId, undrawnDefenderId),
  undrawnDefenderId,
).state;
assert(
  !defenderVictory.players[undrawnDefenderId].hasPlayedThisRound,
  'Playing as defender must not count as being drawn as attacker',
);
assert(
  getDrawCandidates(defenderVictory).some((player) => player.id === undrawnDefenderId),
  'A defender who was never drawn must stay in the lottery',
);
assert(
  !getDrawCandidates(defenderVictory).some((player) => player.id === drawnAttackerId),
  'An eliminated player must never return to the lottery',
);

let humanChampionState = createInitialGame('animals', fixedRandom);
let humanBattles = 0;
while (!getChampion(humanChampionState) && humanBattles < 15) {
  const targetId = getNeighborPlayerIds(humanChampionState, 'human')[0];
  humanChampionState = resolveBattle(
    humanChampionState,
    createBattleSetup(humanChampionState, 'human', targetId),
    'human',
  ).state;
  humanBattles += 1;
}
assert(getChampion(humanChampionState)?.id === 'human', 'The human must be able to conquer the full arena');
assert(humanChampionState.players.human.cellIds.length === 16, 'A champion must own all 16 cells');
assert(humanBattles === 15, 'A full 16-player game must end after 15 eliminations');

let aiChampionState = createInitialGame('animals', fixedRandom);
const aiChampionId = getNeighborPlayerIds(aiChampionState, 'human')[0];
aiChampionState = resolveBattle(
  aiChampionState,
  createBattleSetup(aiChampionState, aiChampionId, 'human'),
  aiChampionId,
).state;
let aiBattles = 1;
while (!getChampion(aiChampionState) && aiBattles < 15) {
  const targetId = getNeighborPlayerIds(aiChampionState, aiChampionId)[0];
  aiChampionState = resolveBattle(
    aiChampionState,
    createBattleSetup(aiChampionState, aiChampionId, targetId),
    aiChampionId,
  ).state;
  aiBattles += 1;
}
assert(getChampion(aiChampionState)?.id === aiChampionId, 'A computer player must be able to become champion');
assert(aiChampionState.players[aiChampionId].cellIds.length === 16, 'The computer champion must own all 16 cells');

const animationCandidates = ['a', 'b', 'c', 'd'];
const animationValues = [0.8, 0.1, 0.65, 0.35, 0.95, 0.2];
let animationValueIndex = 0;
const animationSequence = createRandomDrawSequence(
  animationCandidates,
  animationValues.length,
  () => animationValues[animationValueIndex++],
);
assert(
  animationSequence.every((playerId) => animationCandidates.includes(playerId)),
  'The draw animation may only visit eligible candidates',
);
assert(
  animationSequence.every((playerId, index) => index === 0 || playerId !== animationSequence[index - 1]),
  'The draw animation must jump between candidates instead of repeating one territory',
);
assert(
  animationSequence.join(',') !== 'a,b,c,d,a,b',
  'The draw animation must not move through candidates in board order',
);
assert(isCorrectAnswer('  ארה״ב ', 'ארצות הברית', ['ארהב', 'ארה״ב']), 'Aliases and punctuation must normalize');
assert(isCorrectAnswer('מלכ', 'מלך', []), 'Hebrew final kaf must normalize');
assert(isCorrectAnswer('תפוחימ', 'תפוחים', []), 'Hebrew final mem must normalize');
assert(isCorrectAnswer('עיפ', 'עיף', []), 'Hebrew final pe must normalize');
assert(isCorrectAnswer('ארצ', 'ארץ', []), 'Hebrew final tsadi must normalize');
assert(isCorrectAnswer('שולחנ', 'שולחן', []), 'Hebrew final nun must normalize');

const battleDeck = createBattleDeck(CATEGORIES[0].items, fixedRandom);
assert(new Set(battleDeck.map((item) => item.id)).size === battleDeck.length, 'A battle deck must not repeat an item');
assert(battleDeck.length === 24, 'Each prototype category must provide 24 unique prompts');
assert(CATEGORIES.every((category) => category.items.length === 24), 'Every category must provide 24 prompts');
assert(battleDeck.slice(0, 8).every((item) => item.difficulty === 1), 'Easy prompts must appear first');
assert(battleDeck.slice(8, 16).every((item) => item.difficulty === 2), 'Medium prompts must appear second');
assert(battleDeck.slice(16).every((item) => item.difficulty === 3), 'Hard prompts must appear last');

console.log('Engine smoke tests passed');
